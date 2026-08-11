import cron from 'node-cron';
import { syncWeekGames, updateLiveScores, syncWinProbabilities, backfillTeamStats } from './espnService';
import { awardWeeklyTrophies } from './trophyService';
import { notifyWeekUnlocked, notifyDeadlineApproaching, notifyPicksLocked, notifyDefaultPicksApplied } from './notificationService';
import { getCurrentNFLSeason, getCurrentNFLWeek, isPreseasonMode } from '../utils/season';
import { db } from '../db';
import { games } from '../db/schema';
import * as schema from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { logActivity } from '../routes/activity';

const PT = { timezone: 'America/Los_Angeles' };

async function getActiveWeek(): Promise<number> {
  return getCurrentNFLWeek();
}

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

// Tuesday 6AM PT — weekly transition: award trophies, sync new week games
cron.schedule('0 6 * * 2', async () => {
  try {
    if (await isPreseasonMode()) return;
    const season = getCurrentNFLSeason();
    const week = await getActiveWeek();

    console.log(`[Scheduler] Tuesday 6AM: weekly transition for Week ${week}`);

    // Award trophies for completed week
    if (week > 1) await awardWeeklyTrophies(week - 1, season);

    // Sync new week's games from ESPN
    await syncWeekGames(week, season, 'regular');

    // Backfill box score stats for all completed games in the prior week
    await backfillTeamStats(season, 'regular');

    // Auto-unlock week in DB so the picks gate opens
    await db.insert(schema.unlockedWeeks)
      .values({ week, season, seasonType: 'regular', unlockedBy: 'scheduler' })
      .onConflictDoNothing();

    // Notify users week is open
    await notifyWeekUnlocked(week);

    await logActivity('week_opened', `Week ${week} picks are now open!`, 'global', { metadata: { week, season } });
  } catch (err) {
    console.error('[Scheduler] Tuesday 6AM job failed:', err);
  }
}, PT);

// Tuesday 9PM PT — win probability refresh
cron.schedule('0 21 * * 2', async () => {
  try {
    const season = getCurrentNFLSeason();
    const week = await getActiveWeek();
    await syncWinProbabilities(week, season);
  } catch (err) {
    console.error('[Scheduler] Tuesday 9PM prob sync failed:', err);
  }
}, PT);

// Wednesday 6AM PT — win probability refresh
cron.schedule('0 6 * * 3', async () => {
  try {
    const season = getCurrentNFLSeason();
    const week = await getActiveWeek();
    await syncWinProbabilities(week, season);
  } catch (err) {
    console.error('[Scheduler] Wednesday 6AM prob sync failed:', err);
  }
}, PT);

// Wednesday 5PM PT — win probability refresh
cron.schedule('0 17 * * 3', async () => {
  try {
    const season = getCurrentNFLSeason();
    const week = await getActiveWeek();
    await syncWinProbabilities(week, season);
  } catch (err) {
    console.error('[Scheduler] Wednesday 5PM prob sync failed:', err);
  }
}, PT);

// Wednesday 8PM PT — 1 hour warning
cron.schedule('0 20 * * 3', async () => {
  try {
    const week = await getActiveWeek();
    await notifyDeadlineApproaching(week);
  } catch (err) {
    console.error('[Scheduler] Wednesday 8PM warning failed:', err);
  }
}, PT);

// Wednesday 9PM PT — picks lock notification + apply default picks
cron.schedule('0 21 * * 3', async () => {
  try {
    const season = getCurrentNFLSeason();
    const week = await getActiveWeek();
    await notifyPicksLocked(week);
    await logActivity('picks_locked', `Week ${week} picks are locked. Good luck!`, 'global', { metadata: { week, season } });
    await applyDefaultPicks(week, season);
  } catch (err) {
    console.error('[Scheduler] Wednesday 9PM lock notification failed:', err);
  }
}, PT);

// Apply default picks for users who didn't pick all games.
// Default: Raiders if playing, otherwise away team.
// Only runs if the week is unlocked; reads seasonType from unlocked_weeks instead of hardcoding.
async function applyDefaultPicks(week: number, season: number): Promise<void> {
  const RAIDERS_NAMES = new Set(['Las Vegas Raiders', 'LV']);

  try {
    const unlocked = await db.query.unlockedWeeks.findFirst({
      where: and(
        eq(schema.unlockedWeeks.week, week),
        eq(schema.unlockedWeeks.season, season),
      ),
    });

    if (!unlocked) {
      console.log(`[Scheduler] applyDefaultPicks: week ${week} season ${season} not unlocked — skipping`);
      return;
    }

    const seasonType = unlocked.seasonType;

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

    for (const user of allUsers) {
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
      }

      notifyDefaultPicksApplied(user.id, missing.length, week).catch(err =>
        console.error('[Scheduler] notifyDefaultPicksApplied failed for user', user.id, err)
      );

      console.log(`[Scheduler] Applied ${missing.length} default pick(s) for user ${user.id} (${seasonType})`);
    }
  } catch (err) {
    console.error('[Scheduler] applyDefaultPicks failed:', err);
  }
}

console.log('[Scheduler] All cron jobs registered (America/Los_Angeles)');
