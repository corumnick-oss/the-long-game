import cron from 'node-cron';
import { syncWeekGames, updateLiveScores, syncWinProbabilities, backfillTeamStats } from './espnService';
import { awardWeeklyTrophies, getWeeklyRecords } from './trophyService';
import { notifyWeekUnlocked, notifyDeadlineApproaching, notifyPicksLocked, notifyDefaultPicksApplied, notifyWeekSummary } from './notificationService';
import { sendWeeklyPicksEmails } from './emailService';
import { getCurrentNFLSeason, getCurrentWeekAndType, getNextWeekToUnlock } from '../utils/season';
import { getWeekLockTime } from '../utils/lockTime';
import { db } from '../db';
import { games } from '../db/schema';
import * as schema from '../db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { logActivity } from '../routes/activity';

const PT = { timezone: 'America/Los_Angeles' };

// Every 30 seconds — live score updates. updateLiveScores() itself finds games that should
// have started but aren't final yet, so this must run unconditionally — it's what bootstraps
// the pre→in transition in the first place, not just what keeps an already-live game updated.
cron.schedule('*/30 * * * * *', async () => {
  try {
    await updateLiveScores();
  } catch (err) {
    console.error('[Scheduler] Live score update failed:', err);
  }
});

// Tuesday 6AM PT — weekly transition: award trophies, sync new week games.
// seasonType is whatever getCurrentWeekAndType() actually finds active (preseason or
// regular) -- this now runs unconditionally instead of bailing on an admin toggle that
// was effectively always off, so preseason weeks advance automatically same as regular ones.
cron.schedule('0 6 * * 2', async () => {
  try {
    const season = getCurrentNFLSeason();
    const { week, seasonType } = await getNextWeekToUnlock();

    console.log(`[Scheduler] Tuesday 6AM: weekly transition for ${seasonType} Week ${week}`);

    // Weekly Achievements ("trophies") are regular-season only for now.
    if (seasonType === 'regular' && week > 1) await awardWeeklyTrophies(week - 1, season);

    // Week summary notification ("You went X-Y this week!") — unlike Achievements, this
    // fires for both preseason and regular season.
    if (week > 1) {
      const records = await getWeeklyRecords(week - 1, season, seasonType);
      for (const record of records) {
        notifyWeekSummary(record.userId, week - 1, seasonType, record.wins, record.losses).catch(err =>
          console.error('[Scheduler] notifyWeekSummary failed for user', record.userId, err)
        );
      }
    }

    // Sync new week's games from ESPN
    await syncWeekGames(week, season, seasonType);

    // Backfill box score stats for all completed games in the prior week
    await backfillTeamStats(season, seasonType);

    // Auto-unlock week in DB so the picks gate opens
    await db.insert(schema.unlockedWeeks)
      .values({ week, season, seasonType, unlockedBy: 'scheduler' })
      .onConflictDoNothing();

    // Notify users week is open
    await notifyWeekUnlocked(week, seasonType, season);

    await logActivity('week_opened', `${seasonType === 'preseason' ? 'Preseason ' : ''}Week ${week} picks are now open!`, 'global', { metadata: { week, season, seasonType } });
  } catch (err) {
    console.error('[Scheduler] Tuesday 6AM job failed:', err);
  }
}, PT);

// Tuesday 9PM PT — win probability refresh (regular season only; ESPN doesn't publish
// predictor data for preseason games at all, confirmed directly against their API)
cron.schedule('0 21 * * 2', async () => {
  try {
    const season = getCurrentNFLSeason();
    const { week, seasonType } = await getCurrentWeekAndType();
    if (seasonType === 'regular') await syncWinProbabilities(week, season);
  } catch (err) {
    console.error('[Scheduler] Tuesday 9PM prob sync failed:', err);
  }
}, PT);

// Wednesday 6AM PT — win probability refresh
cron.schedule('0 6 * * 3', async () => {
  try {
    const season = getCurrentNFLSeason();
    const { week, seasonType } = await getCurrentWeekAndType();
    if (seasonType === 'regular') await syncWinProbabilities(week, season);
  } catch (err) {
    console.error('[Scheduler] Wednesday 6AM prob sync failed:', err);
  }
}, PT);

// Wednesday 5PM PT — win probability refresh
cron.schedule('0 17 * * 3', async () => {
  try {
    const season = getCurrentNFLSeason();
    const { week, seasonType } = await getCurrentWeekAndType();
    if (seasonType === 'regular') await syncWinProbabilities(week, season);
  } catch (err) {
    console.error('[Scheduler] Wednesday 5PM prob sync failed:', err);
  }
}, PT);

// Every 5 minutes — dynamic lock reminder + lock actions. Each week's real lock time is
// computed per-week (see lockTime.ts: 11:59PM Pacific the day before that week's earliest
// game), so this replaces what used to be a fixed Wednesday-only cron — a week whose earliest
// game is itself a Wednesday locks Tuesday night, and a Saturday-only week locks Friday night,
// and this check fires the right actions on whichever day that turns out to be.
//
// Checks every week that's been unlocked but not yet marked locked-processed (unlocked_weeks.
// lockProcessedAt), so it also self-heals: if the server was down when a week's lock time
// passed, the next tick still catches it and fires the actions exactly once (guarded by the
// reminderSentAt/lockProcessedAt columns), instead of silently skipping that week forever.
//
// unlocked_weeks has no unique constraint on (week, season, seasonType) -- onConflictDoNothing
// on the insert elsewhere in this file has never actually enforced one-row-per-week (confirmed:
// prod already has duplicate rows for the same week from repeated manual "Unlock Week" taps
// during testing). Deduping by that triple here is what keeps a duplicate row from causing the
// lock push / email to fire twice for the same real week.
cron.schedule('*/5 * * * *', async () => {
  try {
    const pending = await db.query.unlockedWeeks.findMany({
      where: isNull(schema.unlockedWeeks.lockProcessedAt),
    });

    const seenKeys = new Set<string>();

    for (const row of pending) {
      const seasonType = row.seasonType as 'regular' | 'preseason';
      const key = `${row.week}|${row.season}|${seasonType}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const lockTime = await getWeekLockTime(row.week, row.season, seasonType);
      if (!lockTime) continue;

      const now = new Date();
      const alreadyLocked = now >= lockTime;
      const reminderThreshold = new Date(lockTime.getTime() - 4 * 60 * 60 * 1000);
      const rowMatch = and(eq(schema.unlockedWeeks.week, row.week), eq(schema.unlockedWeeks.season, row.season), eq(schema.unlockedWeeks.seasonType, seasonType));

      // Skip the "lock tonight" reminder entirely if we're already past lock time (e.g. after
      // extended downtime) — no point warning about a deadline that's already passed.
      if (!row.reminderSentAt && !alreadyLocked && now >= reminderThreshold) {
        await notifyDeadlineApproaching(row.week, seasonType);
        await db.update(schema.unlockedWeeks).set({ reminderSentAt: new Date() }).where(rowMatch);
      }

      if (alreadyLocked) {
        await notifyPicksLocked(row.week, seasonType);
        await logActivity('picks_locked', `${seasonType === 'preseason' ? 'Preseason ' : ''}Week ${row.week} picks are locked. Good luck!`, 'global', { metadata: { week: row.week, season: row.season, seasonType } });
        await applyDefaultPicks(row.week, row.season, seasonType);

        // Proof-of-picks email, sent after default picks so it reflects each user's final state.
        sendWeeklyPicksEmails(row.week, row.season, seasonType).catch(err =>
          console.error('[Scheduler] sendWeeklyPicksEmails failed:', err)
        );

        // Marks every row sharing this (week, season, seasonType), not just this one — see note
        // above about duplicate rows.
        await db.update(schema.unlockedWeeks).set({ lockProcessedAt: new Date() }).where(rowMatch);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Lock check failed:', err);
  }
}, PT);

// Apply default picks for users who didn't pick all games.
// Default: Raiders if playing, otherwise away team.
// Only runs if the week is unlocked for the given seasonType.
export async function applyDefaultPicks(week: number, season: number, seasonType: 'regular' | 'preseason'): Promise<void> {
  const RAIDERS_NAMES = new Set(['Las Vegas Raiders', 'LV']);

  try {
    const unlocked = await db.query.unlockedWeeks.findFirst({
      where: and(
        eq(schema.unlockedWeeks.week, week),
        eq(schema.unlockedWeeks.season, season),
        eq(schema.unlockedWeeks.seasonType, seasonType),
      ),
    });

    if (!unlocked) {
      console.log(`[Scheduler] applyDefaultPicks: ${seasonType} week ${week} season ${season} not unlocked — skipping`);
      return;
    }

    const weekGames = await db.query.games.findMany({
      where: and(
        eq(games.week, week),
        eq(games.season, season),
        eq(games.sport, 'nfl'),
        eq(games.seasonType, seasonType),
      ),
    });

    if (weekGames.length === 0) return;

    const gameIds = weekGames.map(g => g.id);
    const allUsers = await db.query.users.findMany({ where: eq(schema.users.nflAccess, true) });
    const allPicks = await db.query.picks.findMany({ where: inArray(schema.picks.gameId, gameIds) });

    const pickMap = new Map<string, Set<string>>();
    for (const pick of allPicks) {
      if (!pickMap.has(pick.userId)) pickMap.set(pick.userId, new Set());
      pickMap.get(pick.userId)!.add(pick.gameId);
    }

    // Only default-pick users who already completed at least one OTHER week this season --
    // a brand-new player's very first active week never gets auto-filled, even for games they
    // forgot, so someone who never picks anything doesn't get carried along all year on
    // Raiders/away-team defaults alone.
    const seasonPicks = await db.select({ userId: schema.picks.userId, week: games.week, seasonType: games.seasonType })
      .from(schema.picks)
      .innerJoin(games, eq(games.id, schema.picks.gameId))
      .where(and(eq(games.season, season), eq(games.sport, 'nfl')));
    const priorWeekPickUserIds = new Set(
      seasonPicks.filter(p => !(p.week === week && p.seasonType === seasonType)).map(p => p.userId)
    );

    for (const user of allUsers) {
      if (!priorWeekPickUserIds.has(user.id)) continue;

      const userPicked = pickMap.get(user.id) ?? new Set();
      const missing = weekGames.filter(g => !userPicked.has(g.id));
      if (missing.length === 0) continue;

      for (const game of missing) {
        const isRaidersHome = RAIDERS_NAMES.has(game.homeTeam);
        const isRaidersAway = RAIDERS_NAMES.has(game.awayTeam);
        const pick: 'home' | 'away' = isRaidersHome ? 'home' : isRaidersAway ? 'away' : 'away';

        await db.insert(schema.picks).values({
          userId: user.id,
          gameId: game.id,
          pick,
          pickWinProbability: game.winningTeamWinProb,
        }).onConflictDoNothing();
        await db.insert(schema.pickAuditLog).values({
          userId: user.id, gameId: game.id, action: 'default_applied',
          previousPick: null, newPick: pick,
        });
      }

      notifyDefaultPicksApplied(user.id, missing.length, week, seasonType).catch(err =>
        console.error('[Scheduler] notifyDefaultPicksApplied failed for user', user.id, err)
      );

      console.log(`[Scheduler] Applied ${missing.length} default pick(s) for user ${user.id} (${seasonType})`);
    }
  } catch (err) {
    console.error('[Scheduler] applyDefaultPicks failed:', err);
  }
}

console.log('[Scheduler] All cron jobs registered (America/Los_Angeles)');
