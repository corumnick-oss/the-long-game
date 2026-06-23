import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { sql, eq, and, desc, asc } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { syncWeekGames, syncWeekScores, syncWinProbabilities, syncGamesByEventIds, backfillTeamStats } from '../services/espnService';
import { awardWeeklyTrophies } from '../services/trophyService';
import { getCurrentNFLSeason } from '../utils/season';
import { logActivity } from './activity';
import { sendPushToUsers } from '../services/notificationService';

const router = Router();

router.use(requireAuth, requireAdmin);

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  const allUsers = await db.query.users.findMany({ orderBy: [asc(schema.users.teamName)] });
  res.json(allUsers);
});

router.patch('/users/:id', async (req, res) => {
  const { isLongie, isAdmin, nflAccess, teamName } = req.body as Record<string, any>;
  const updates: Partial<typeof schema.users.$inferInsert> = { updatedAt: new Date() };

  if (isLongie !== undefined) updates.isLongie = Boolean(isLongie);
  if (isAdmin !== undefined) updates.isAdmin = Boolean(isAdmin);
  if (nflAccess !== undefined) updates.nflAccess = Boolean(nflAccess);
  if (teamName?.trim()) updates.teamName = teamName.trim();

  const [updated] = await db.update(schema.users).set(updates).where(eq(schema.users.id, req.params['id']!)).returning();
  if (!updated) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(updated);
});

// ── Games / ESPN Sync ─────────────────────────────────────────────────────────

router.post('/games/sync', async (req, res) => {
  const season = req.body.season ?? getCurrentNFLSeason();
  const week = parseInt(req.body.week, 10);
  const seasonType = req.body.seasonType ?? 'regular';

  if (!week) { res.status(400).json({ error: 'week required' }); return; }

  try {
    const count = await syncWeekGames(week, season, seasonType);
    await logActivity('admin_sync', `Admin synced ${count} games for Week ${week}`, 'admin', { metadata: { week, season } });
    res.json({ synced: count, week, season });
  } catch (err: any) {
    const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? 'Unknown error');
    res.status(500).json({ error: `ESPN sync failed: ${msg}` });
  }
});

// Sync all weeks for a full season + seasonType in one shot
router.post('/games/sync-full-season', async (req, res) => {
  const season = req.body.season ?? getCurrentNFLSeason();
  const seasonType: 'preseason' | 'regular' = req.body.seasonType ?? 'regular';
  const maxWeek = seasonType === 'preseason' ? 4 : 18;

  let total = 0;
  const results: { week: number; synced: number }[] = [];

  for (let week = 1; week <= maxWeek; week++) {
    try {
      const count = await syncWeekGames(week, season, seasonType);
      total += count;
      results.push({ week, synced: count });
    } catch (err: any) {
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? 'Unknown error');
      results.push({ week, synced: 0 });
      console.warn(`[sync] week ${week} failed: ${msg}`);
    }
  }

  await logActivity('admin_sync', `Admin synced full ${seasonType} season ${season}: ${total} games`, 'admin', { metadata: { season, seasonType, total } });
  res.json({ total, season, seasonType, results });
});

// Mobile-assisted sync: mobile collects ESPN event IDs (bypassing Railway block),
// backend fetches /summary for each (which works from Railway) and upserts.
router.post('/games/sync-by-ids', async (req, res) => {
  const { eventIds, week, season, seasonType = 'regular' } = req.body;
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    res.status(400).json({ error: 'eventIds array required' }); return;
  }
  try {
    const synced = await syncGamesByEventIds(eventIds, Number(week), Number(season), seasonType);
    await logActivity('admin_sync', `Admin synced ${synced} games for Week ${week} ${season}`, 'admin', { metadata: { week, season, seasonType } });
    res.json({ synced, week, season });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Sync failed' });
  }
});

router.post('/games/sync-full-season-by-ids', async (req, res) => {
  const { weekEvents, season, seasonType = 'regular' } = req.body;
  if (!Array.isArray(weekEvents) || weekEvents.length === 0) {
    res.status(400).json({ error: 'weekEvents array required' }); return;
  }
  let total = 0;
  const results: { week: number; synced: number }[] = [];
  for (const { week, eventIds } of weekEvents) {
    if (!Array.isArray(eventIds) || eventIds.length === 0) continue;
    try {
      const synced = await syncGamesByEventIds(eventIds, Number(week), Number(season), seasonType);
      total += synced;
      results.push({ week, synced });
    } catch (err: any) {
      console.warn(`[sync] week ${week} failed: ${err?.message}`);
      results.push({ week, synced: 0 });
    }
  }
  await logActivity('admin_sync', `Admin synced full ${seasonType} ${season}: ${total} games`, 'admin', { metadata: { season, seasonType, total } });
  res.json({ total, season, seasonType, results });
});

router.patch('/games/:id', async (req, res) => {
  const { homeScore, awayScore, status, isScoreLocked } = req.body as Record<string, any>;
  const updates: Partial<typeof schema.games.$inferInsert> = {};

  if (homeScore !== undefined) updates.homeScore = parseInt(homeScore, 10);
  if (awayScore !== undefined) updates.awayScore = parseInt(awayScore, 10);
  if (status) updates.status = status;
  if (isScoreLocked !== undefined) updates.isScoreLocked = Boolean(isScoreLocked);

  const [updated] = await db.update(schema.games).set(updates).where(eq(schema.games.id, req.params['id']!)).returning();
  if (!updated) { res.status(404).json({ error: 'Game not found' }); return; }

  await logActivity('score_correction', `Score corrected: ${updated.awayTeam} @ ${updated.homeTeam}`, 'global', { metadata: { gameId: updated.id } });
  res.json(updated);
});

router.post('/games/sync-scores', async (req, res) => {
  const season = req.body.season ?? getCurrentNFLSeason();
  const week = parseInt(req.body.week, 10);
  const seasonType = req.body.seasonType ?? 'regular';
  if (!week) { res.status(400).json({ error: 'week required' }); return; }

  const count = await syncWeekScores(week, season, seasonType);
  res.json({ updated: count, week, season });
});

// ── Team Stats Backfill ───────────────────────────────────────────────────────

router.post('/sync-team-stats', async (req, res) => {
  const season = req.body.season ?? getCurrentNFLSeason();
  const seasonType = req.body.seasonType ?? 'regular';

  try {
    const synced = await backfillTeamStats(season, seasonType);
    res.json({ synced, season, seasonType });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Stats sync failed' });
  }
});

// ── Win Probabilities ─────────────────────────────────────────────────────────

router.post('/games/sync-probs', async (req, res) => {
  const season = req.body.season ?? getCurrentNFLSeason();
  const week = parseInt(req.body.week, 10);
  if (!week) { res.status(400).json({ error: 'week required' }); return; }

  const updated = await syncWinProbabilities(week, season);
  res.json({ ok: true, week, season, updated });
});

// ── Trophies ──────────────────────────────────────────────────────────────────

router.post('/trophies/award', async (req, res) => {
  const season = req.body.season ?? getCurrentNFLSeason();
  const week = parseInt(req.body.week, 10);
  const type = req.body.type as string | undefined;

  if (!week) { res.status(400).json({ error: 'week required' }); return; }

  const awarded = await awardWeeklyTrophies(week, season, type);
  await logActivity('trophies_awarded', `Trophies awarded for Week ${week}`, 'global', { metadata: { week, season, awarded } });
  res.json({ awarded, week, season });
});

// ── Picks (admin read + edit) ─────────────────────────────────────────────────

router.get('/picks', async (req, res) => {
  const userId = req.query['userId'] as string | undefined;
  const week = req.query['week'] ? parseInt(req.query['week'] as string, 10) : undefined;
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();

  let gameIds: string[] | undefined;
  if (week) {
    const weekGames = await db.query.games.findMany({
      where: and(eq(schema.games.week, week), eq(schema.games.season, season), eq(schema.games.sport, 'nfl')),
    });
    gameIds = weekGames.map(g => g.id);
  }

  const { inArray } = await import('drizzle-orm');
  const conditions = [];
  if (userId) conditions.push(eq(schema.picks.userId, userId));
  if (gameIds?.length) conditions.push(inArray(schema.picks.gameId, gameIds));

  const picks = await db.query.picks.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(schema.picks.createdAt)],
  });
  res.json(picks);
});

// Admin edit pick — requires confirm; always logs to pick_audit_log
router.patch('/picks/:id', async (req, res) => {
  const { pick, confirmed } = req.body as { pick: 'home' | 'away'; confirmed: boolean };

  if (!confirmed) { res.status(400).json({ error: 'Set confirmed: true to edit a pick' }); return; }
  if (!pick || !['home', 'away'].includes(pick)) { res.status(400).json({ error: 'pick (home|away) required' }); return; }

  const existing = await db.query.picks.findFirst({ where: eq(schema.picks.id, req.params['id']!) });
  if (!existing) { res.status(404).json({ error: 'Pick not found' }); return; }

  await db.insert(schema.pickAuditLog).values({
    userId: existing.userId,
    gameId: existing.gameId,
    action: 'admin_edit',
    previousPick: existing.pick,
    newPick: pick,
    adminId: req.currentUser!.id,
  });

  const [updated] = await db.update(schema.picks).set({ pick }).where(eq(schema.picks.id, existing.id)).returning();
  res.json(updated);
});

// ── Unlock Week ───────────────────────────────────────────────────────────────

router.post('/unlock-week', async (req, res) => {
  const season = req.body.season ?? getCurrentNFLSeason();
  const week = parseInt(req.body.week, 10);
  const seasonType = (req.body.seasonType as string) ?? 'regular';
  if (!week) { res.status(400).json({ error: 'week required' }); return; }

  await db.insert(schema.unlockedWeeks).values({ week, season, seasonType, unlockedBy: req.currentUser!.id }).onConflictDoNothing();
  await logActivity('week_unlocked', `Week ${week} picks are now open!`, 'global', { metadata: { week, season, seasonType } });
  res.json({ ok: true, week, season, seasonType });
});

// ── Week Settings ─────────────────────────────────────────────────────────────

router.get('/week-settings', async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const settings = await db.query.weekSettings.findMany({
    where: eq(schema.weekSettings.season, season),
    orderBy: [asc(schema.weekSettings.week)],
  });
  res.json(settings);
});

router.put('/week-settings', async (req, res) => {
  const { week, season = getCurrentNFLSeason(), lockTime, notes } = req.body as { week: number; season?: number; lockTime?: string; notes?: string };
  if (!week) { res.status(400).json({ error: 'week required' }); return; }

  const existing = await db.query.weekSettings.findFirst({
    where: and(eq(schema.weekSettings.week, week), eq(schema.weekSettings.season, season)),
  });

  const values = { week, season, lockTime: lockTime ? new Date(lockTime) : null, notes: notes ?? null };

  if (existing) {
    const [updated] = await db.update(schema.weekSettings).set(values).where(eq(schema.weekSettings.id, existing.id)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(schema.weekSettings).values(values).returning();
    res.json(created);
  }
});

// ── App Settings ──────────────────────────────────────────────────────────────

router.get('/app-settings', async (req, res) => {
  const settings = await db.query.appSettings.findMany();
  res.json(Object.fromEntries(settings.map(s => [s.key, s.value])));
});

router.patch('/app-settings', async (req, res) => {
  const updates = req.body as Record<string, string>;
  const allowed = ['seasonStartDate', 'currentSeason', 'preseasonMode', 'currentWeek'];

  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue;
    await db.insert(schema.appSettings).values({ key, value, updatedAt: new Date() }).onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value, updatedAt: new Date() },
    });
  }
  res.json({ ok: true });
});

// ── Tiebreaker Designate ──────────────────────────────────────────────────────

router.post('/tiebreaker/designate', async (req, res) => {
  const { gameId, description, week, season = getCurrentNFLSeason() } = req.body as { gameId: string; description?: string; week: number; season?: number };
  if (!gameId || !week) { res.status(400).json({ error: 'gameId and week required' }); return; }

  const game = await db.query.games.findFirst({ where: eq(schema.games.id, gameId) });
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }

  const [created] = await db.insert(schema.tiebreakerGames).values({
    season,
    week,
    gameId,
    description: description ?? `Week ${week} tiebreaker: predict combined score`,
  }).returning();
  res.status(201).json(created);
});

// ── Notification Testing ──────────────────────────────────────────────────────

router.get('/notifications/token-status', async (req, res) => {
  const userId = req.currentUser!.id;
  const tokens = await db.query.pushTokens.findMany({
    where: eq(schema.pushTokens.userId, userId),
  });
  res.json({ hasToken: tokens.length > 0, tokenCount: tokens.length, userId });
});

router.post('/notifications/test', async (req, res) => {
  try {
    const userId = req.currentUser!.id;
    const tokens = await db.query.pushTokens.findMany({
      where: eq(schema.pushTokens.userId, userId),
    });
    if (tokens.length === 0) {
      res.status(400).json({ error: 'No push token registered for this user. Open the app on your device and grant notification permission first.' });
      return;
    }
    const tickets = await sendPushToUsers([userId], 'Test Notification 🏈', 'Push notifications are working!', { type: 'test' });
    res.json({ sent: true, tokenCount: tokens.length, tickets });
  } catch (err: any) {
    console.error('[Admin] notifications/test error:', err);
    res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
});

let scheduledTestTimeout: ReturnType<typeof setTimeout> | null = null;
let scheduledTestUserId: string | null = null;

router.post('/notifications/schedule-test', async (req, res) => {
  try {
    const userId = req.currentUser!.id;
    const { delayMinutes } = req.body as { delayMinutes: number };

    if (!delayMinutes || delayMinutes < 1 || delayMinutes > 60) {
      res.status(400).json({ error: 'delayMinutes must be 1–60' });
      return;
    }

    if (scheduledTestTimeout) {
      clearTimeout(scheduledTestTimeout);
    }

    const fireAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    scheduledTestUserId = userId;
    scheduledTestTimeout = setTimeout(async () => {
      if (scheduledTestUserId) {
        await sendPushToUsers(
          [scheduledTestUserId],
          '1 hour left for picks! 🏈',
          'Lock in your picks before they close. (Scheduled test)',
          { type: 'deadline_test' }
        );
      }
      scheduledTestTimeout = null;
      scheduledTestUserId = null;
    }, delayMinutes * 60 * 1000);

    res.json({ scheduled: true, fireAt: fireAt.toISOString(), delayMinutes });
  } catch (err: any) {
    console.error('[Admin] notifications/schedule-test error:', err);
    res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
});

router.delete('/notifications/schedule-test', async (req, res) => {
  if (scheduledTestTimeout) {
    clearTimeout(scheduledTestTimeout);
    scheduledTestTimeout = null;
    scheduledTestUserId = null;
  }
  res.json({ cancelled: true });
});

// ── Export ────────────────────────────────────────────────────────────────────

router.get('/export', async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();

  const [allUsers, allGames, allPicks, allTrophies] = await Promise.all([
    db.query.users.findMany(),
    db.query.games.findMany({ where: eq(schema.games.season, season) }),
    db.query.picks.findMany(),
    db.query.trophies.findMany({ where: eq(schema.trophies.season, season) }),
  ]);

  res.json({ users: allUsers, games: allGames, picks: allPicks, trophies: allTrophies });
});

export default router;
