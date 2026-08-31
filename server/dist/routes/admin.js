"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const schema = __importStar(require("../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const espnService_1 = require("../services/espnService");
const trophyService_1 = require("../services/trophyService");
const season_1 = require("../utils/season");
const lockTime_1 = require("../utils/lockTime");
const activity_1 = require("./activity");
const notificationService_1 = require("../services/notificationService");
const exportTokens_1 = require("../services/exportTokens");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, auth_1.requireAdmin);
// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
    const allUsers = await db_1.db.query.users.findMany({ orderBy: [(0, drizzle_orm_1.asc)(schema.users.teamName)] });
    res.json(allUsers);
});
router.patch('/users/:id', async (req, res) => {
    const { isGridiron, isAdmin, nflAccess, teamName } = req.body;
    const updates = { updatedAt: new Date() };
    if (isGridiron !== undefined)
        updates.isGridiron = Boolean(isGridiron);
    if (isAdmin !== undefined)
        updates.isAdmin = Boolean(isAdmin);
    if (nflAccess !== undefined)
        updates.nflAccess = Boolean(nflAccess);
    if (teamName?.trim())
        updates.teamName = teamName.trim();
    const [updated] = await db_1.db.update(schema.users).set(updates).where((0, drizzle_orm_1.eq)(schema.users.id, req.params['id'])).returning();
    if (!updated) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json(updated);
});
// ── Games / ESPN Sync ─────────────────────────────────────────────────────────
router.post('/games/sync', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const week = parseInt(req.body.week, 10);
    const seasonType = req.body.seasonType ?? 'regular';
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    try {
        const count = await (0, espnService_1.syncWeekGames)(week, season, seasonType);
        await (0, activity_1.logActivity)('admin_sync', `Admin synced ${count} games for Week ${week}`, 'admin', { metadata: { week, season } });
        res.json({ synced: count, week, season });
    }
    catch (err) {
        const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? 'Unknown error');
        res.status(500).json({ error: `ESPN sync failed: ${msg}` });
    }
});
// Sync all weeks for a full season + seasonType in one shot
router.post('/games/sync-full-season', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const seasonType = req.body.seasonType ?? 'regular';
    const maxWeek = seasonType === 'preseason' ? 4 : 18;
    let total = 0;
    const results = [];
    for (let week = 1; week <= maxWeek; week++) {
        try {
            const count = await (0, espnService_1.syncWeekGames)(week, season, seasonType);
            total += count;
            results.push({ week, synced: count });
        }
        catch (err) {
            const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? 'Unknown error');
            results.push({ week, synced: 0 });
            console.warn(`[sync] week ${week} failed: ${msg}`);
        }
    }
    await (0, activity_1.logActivity)('admin_sync', `Admin synced full ${seasonType} season ${season}: ${total} games`, 'admin', { metadata: { season, seasonType, total } });
    res.json({ total, season, seasonType, results });
});
// Mobile-assisted sync: mobile collects ESPN event IDs (bypassing Railway block),
// backend fetches /summary for each (which works from Railway) and upserts.
router.post('/games/sync-by-ids', async (req, res) => {
    const { eventIds, week, season, seasonType = 'regular' } = req.body;
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
        res.status(400).json({ error: 'eventIds array required' });
        return;
    }
    try {
        const synced = await (0, espnService_1.syncGamesByEventIds)(eventIds, Number(week), Number(season), seasonType);
        await (0, activity_1.logActivity)('admin_sync', `Admin synced ${synced} games for Week ${week} ${season}`, 'admin', { metadata: { week, season, seasonType } });
        res.json({ synced, week, season });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? 'Sync failed' });
    }
});
router.post('/games/sync-full-season-by-ids', async (req, res) => {
    const { weekEvents, season, seasonType = 'regular' } = req.body;
    if (!Array.isArray(weekEvents) || weekEvents.length === 0) {
        res.status(400).json({ error: 'weekEvents array required' });
        return;
    }
    let total = 0;
    const results = [];
    for (const { week, eventIds } of weekEvents) {
        if (!Array.isArray(eventIds) || eventIds.length === 0)
            continue;
        try {
            const synced = await (0, espnService_1.syncGamesByEventIds)(eventIds, Number(week), Number(season), seasonType);
            total += synced;
            results.push({ week, synced });
        }
        catch (err) {
            console.warn(`[sync] week ${week} failed: ${err?.message}`);
            results.push({ week, synced: 0 });
        }
    }
    await (0, activity_1.logActivity)('admin_sync', `Admin synced full ${seasonType} ${season}: ${total} games`, 'admin', { metadata: { season, seasonType, total } });
    res.json({ total, season, seasonType, results });
});
router.patch('/games/:id', async (req, res) => {
    const { homeScore, awayScore, status, isScoreLocked } = req.body;
    const updates = {};
    if (homeScore !== undefined)
        updates.homeScore = parseInt(homeScore, 10);
    if (awayScore !== undefined)
        updates.awayScore = parseInt(awayScore, 10);
    if (status)
        updates.status = status;
    if (isScoreLocked !== undefined)
        updates.isScoreLocked = Boolean(isScoreLocked);
    const [updated] = await db_1.db.update(schema.games).set(updates).where((0, drizzle_orm_1.eq)(schema.games.id, req.params['id'])).returning();
    if (!updated) {
        res.status(404).json({ error: 'Game not found' });
        return;
    }
    await (0, activity_1.logActivity)('score_correction', `Score corrected: ${updated.awayTeam} @ ${updated.homeTeam}`, 'global', { metadata: { gameId: updated.id } });
    res.json(updated);
});
// "Sync Scores" is now just syncWeekGames — it already tries /scoreboard first and falls
// back to the team-schedule path, grades finished picks, and fires notifications, all of
// which the old syncWeekScores (plain /scoreboard, no fallback) didn't do.
router.post('/games/sync-scores', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const week = parseInt(req.body.week, 10);
    const seasonType = req.body.seasonType ?? 'regular';
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    try {
        const count = await (0, espnService_1.syncWeekGames)(week, season, seasonType);
        await (0, activity_1.logActivity)('admin_sync', `Admin synced scores for ${count} games in Week ${week}`, 'admin', { metadata: { week, season, seasonType } });
        res.json({ updated: count, week, season });
    }
    catch (err) {
        const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? 'Unknown error');
        res.status(500).json({ error: `Score sync failed: ${msg}` });
    }
});
// ── Team Stats Backfill ───────────────────────────────────────────────────────
router.post('/sync-team-stats', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const seasonType = req.body.seasonType ?? 'regular';
    try {
        const synced = await (0, espnService_1.backfillTeamStats)(season, seasonType);
        res.json({ synced, season, seasonType });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? 'Stats sync failed' });
    }
});
// ── Win Probabilities ─────────────────────────────────────────────────────────
router.post('/games/sync-probs', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const week = parseInt(req.body.week, 10);
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    const updated = await (0, espnService_1.syncWinProbabilities)(week, season);
    res.json({ ok: true, week, season, updated });
});
// ── Trophies ──────────────────────────────────────────────────────────────────
router.post('/trophies/award', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const week = parseInt(req.body.week, 10);
    const type = req.body.type;
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    const awarded = await (0, trophyService_1.awardWeeklyTrophies)(week, season, type);
    await (0, activity_1.logActivity)('trophies_awarded', `Trophies awarded for Week ${week}`, 'global', { metadata: { week, season, awarded } });
    res.json({ awarded, week, season });
});
router.get('/season-standings', async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const standings = await (0, trophyService_1.calculateSeasonStandings)(season);
    res.json({ season, standings });
});
router.post('/trophies/award-season', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const awarded = await (0, trophyService_1.awardSeasonTrophies)(season);
    await (0, activity_1.logActivity)('season_trophies_awarded', `Season trophies awarded for ${season}`, 'global', { metadata: { season, awarded } });
    res.json({ awarded, season });
});
// ── Picks (admin read + edit) ─────────────────────────────────────────────────
router.get('/picks', async (req, res) => {
    const userId = req.query['userId'];
    const week = req.query['week'] ? parseInt(req.query['week'], 10) : undefined;
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    let gameIds;
    if (week) {
        const weekGames = await db_1.db.query.games.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.games.week, week), (0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl')),
        });
        gameIds = weekGames.map(g => g.id);
    }
    const { inArray } = await Promise.resolve().then(() => __importStar(require('drizzle-orm')));
    const conditions = [];
    if (userId)
        conditions.push((0, drizzle_orm_1.eq)(schema.picks.userId, userId));
    if (gameIds?.length)
        conditions.push(inArray(schema.picks.gameId, gameIds));
    const picks = await db_1.db.query.picks.findMany({
        where: conditions.length ? (0, drizzle_orm_1.and)(...conditions) : undefined,
        orderBy: [(0, drizzle_orm_1.desc)(schema.picks.createdAt)],
    });
    res.json(picks);
});
// Admin edit pick — requires confirm; always logs to pick_audit_log
router.patch('/picks/:id', async (req, res) => {
    const { pick, confirmed } = req.body;
    if (!confirmed) {
        res.status(400).json({ error: 'Set confirmed: true to edit a pick' });
        return;
    }
    if (!pick || !['home', 'away'].includes(pick)) {
        res.status(400).json({ error: 'pick (home|away) required' });
        return;
    }
    const existing = await db_1.db.query.picks.findFirst({ where: (0, drizzle_orm_1.eq)(schema.picks.id, req.params['id']) });
    if (!existing) {
        res.status(404).json({ error: 'Pick not found' });
        return;
    }
    await db_1.db.insert(schema.pickAuditLog).values({
        userId: existing.userId,
        gameId: existing.gameId,
        action: 'admin_edit',
        previousPick: existing.pick,
        newPick: pick,
        adminId: req.currentUser.id,
    });
    const [updated] = await db_1.db.update(schema.picks).set({ pick }).where((0, drizzle_orm_1.eq)(schema.picks.id, existing.id)).returning();
    res.json(updated);
});
// GET /api/admin/pick-audit-log?userId=X&week=Y&season=Z&seasonType=regular
// Every pick action (create/update/delete/default_applied/admin_edit) with an exact
// timestamp, resolved to readable team names -- for dispute resolution ("I never picked
// that" / "I didn't change it"). Not paginated; capped at 300 rows, newest first.
router.get('/pick-audit-log', async (req, res) => {
    const userId = req.query['userId'];
    const week = req.query['week'] ? parseInt(req.query['week'], 10) : undefined;
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const seasonType = req.query['seasonType'] ?? 'regular';
    const conditions = [(0, drizzle_orm_1.sql) `g.season = ${season}`, (0, drizzle_orm_1.sql) `g.sport = 'nfl'`, (0, drizzle_orm_1.sql) `g.season_type = ${seasonType}`];
    if (week)
        conditions.push((0, drizzle_orm_1.sql) `g.week = ${week}`);
    if (userId)
        conditions.push((0, drizzle_orm_1.sql) `pal.user_id = ${userId}`);
    const whereClause = conditions.reduce((acc, c) => (0, drizzle_orm_1.sql) `${acc} AND ${c}`);
    const result = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT
      pal.id,
      to_char(pal.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"') AS created_at,
      pal.action,
      u.team_name AS player_name,
      admin_u.team_name AS admin_name,
      g.away_team, g.home_team, g.week, g.season_type,
      CASE WHEN pal.previous_pick = 'home' THEN g.home_team WHEN pal.previous_pick = 'away' THEN g.away_team END AS previous_team,
      CASE WHEN pal.new_pick = 'home' THEN g.home_team WHEN pal.new_pick = 'away' THEN g.away_team END AS new_team
    FROM pick_audit_log pal
    JOIN users u ON u.id = pal.user_id
    JOIN games g ON g.id = pal.game_id
    LEFT JOIN users admin_u ON admin_u.id = pal.admin_id
    WHERE ${whereClause}
    ORDER BY pal.created_at DESC
    LIMIT 300
  `);
    const rows = (result.rows ?? result);
    // Admins are players too -- they must not see anyone's picks (including via this audit
    // trail) before that week's lock, same rule as everyone else. Past/locked weeks stay fully
    // visible for dispute resolution; only the current, not-yet-locked week is withheld.
    const weekKeys = Array.from(new Set(rows.map(r => `${r.week}:${r.season_type}`)));
    const lockedByKey = new Map();
    await Promise.all(weekKeys.map(async (key) => {
        const [w, st] = key.split(':');
        lockedByKey.set(key, await (0, lockTime_1.isWeekLocked)(Number(w), season, st));
    }));
    res.json(rows.filter(r => lockedByKey.get(`${r.week}:${r.season_type}`)));
});
// ── Unlock Week ───────────────────────────────────────────────────────────────
router.post('/unlock-week', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const week = parseInt(req.body.week, 10);
    const seasonType = req.body.seasonType ?? 'regular';
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    await db_1.db.insert(schema.unlockedWeeks).values({ week, season, seasonType, unlockedBy: req.currentUser.id }).onConflictDoNothing();
    await (0, activity_1.logActivity)('week_unlocked', `Week ${week} picks are now open!`, 'global', { metadata: { week, season, seasonType } });
    res.json({ ok: true, week, season, seasonType });
});
// ── Weekly Bonus Opt-ins ──────────────────────────────────────────────────────
// Simple opt-in marker for Nick's optional $5/week side pool. No winner computation here —
// just tracks who paid in for a given week, shown as a "Bonus" badge on the Leaderboard's
// Gridirons-filtered weekly view. Toggle is idempotent (insert-if-absent / delete-if-present).
router.post('/weekly-bonus/toggle', async (req, res) => {
    const userId = req.body.userId;
    const week = parseInt(req.body.week, 10);
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const seasonType = req.body.seasonType ?? 'regular';
    if (!userId || !week) {
        res.status(400).json({ error: 'userId and week required' });
        return;
    }
    const existing = await db_1.db.query.weeklyBonusOptins.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.weeklyBonusOptins.userId, userId), (0, drizzle_orm_1.eq)(schema.weeklyBonusOptins.week, week), (0, drizzle_orm_1.eq)(schema.weeklyBonusOptins.season, season), (0, drizzle_orm_1.eq)(schema.weeklyBonusOptins.seasonType, seasonType)),
    });
    if (existing) {
        await db_1.db.delete(schema.weeklyBonusOptins).where((0, drizzle_orm_1.eq)(schema.weeklyBonusOptins.id, existing.id));
        res.json({ optedIn: false });
    }
    else {
        await db_1.db.insert(schema.weeklyBonusOptins).values({ userId, week, season, seasonType });
        res.json({ optedIn: true });
    }
});
// ── CSV Export ────────────────────────────────────────────────────────────────
// Mints a short-lived (5 min), single-use token for a Gridirons-only weekly picks CSV,
// opened outside the app (system browser can't carry a Bearer header). Gated to locked
// weeks only -- same reasoning as pick-audit-log: admin is a player too, no pre-lock peeking.
router.post('/export-week-picks-token', async (req, res) => {
    const week = parseInt(req.body.week, 10);
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const seasonType = req.body.seasonType ?? 'regular';
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    const locked = await (0, lockTime_1.isWeekLocked)(week, season, seasonType);
    if (!locked) {
        res.status(400).json({ error: 'This week has not locked yet' });
        return;
    }
    const token = (0, exportTokens_1.createExportToken)({ week, season, seasonType });
    res.json({ token });
});
// ── Week Settings ─────────────────────────────────────────────────────────────
router.get('/week-settings', async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const settings = await db_1.db.query.weekSettings.findMany({
        where: (0, drizzle_orm_1.eq)(schema.weekSettings.season, season),
        orderBy: [(0, drizzle_orm_1.asc)(schema.weekSettings.week)],
    });
    res.json(settings);
});
router.put('/week-settings', async (req, res) => {
    const { week, season = (0, season_1.getCurrentNFLSeason)(), lockTime, notes } = req.body;
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    const existing = await db_1.db.query.weekSettings.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.weekSettings.week, week), (0, drizzle_orm_1.eq)(schema.weekSettings.season, season)),
    });
    const values = { week, season, lockTime: lockTime ? new Date(lockTime) : null, notes: notes ?? null };
    if (existing) {
        const [updated] = await db_1.db.update(schema.weekSettings).set(values).where((0, drizzle_orm_1.eq)(schema.weekSettings.id, existing.id)).returning();
        res.json(updated);
    }
    else {
        const [created] = await db_1.db.insert(schema.weekSettings).values(values).returning();
        res.json(created);
    }
});
// ── App Settings ──────────────────────────────────────────────────────────────
router.get('/app-settings', async (req, res) => {
    const settings = await db_1.db.query.appSettings.findMany();
    res.json(Object.fromEntries(settings.map(s => [s.key, s.value])));
});
router.patch('/app-settings', async (req, res) => {
    const updates = req.body;
    const allowed = ['seasonStartDate', 'currentSeason', 'preseasonMode', 'currentWeek', 'forceRegularSeason'];
    for (const [key, value] of Object.entries(updates)) {
        if (!allowed.includes(key))
            continue;
        await db_1.db.insert(schema.appSettings).values({ key, value, updatedAt: new Date() }).onConflictDoUpdate({
            target: schema.appSettings.key,
            set: { value, updatedAt: new Date() },
        });
    }
    res.json({ ok: true });
});
// ── Tiebreaker Designate ──────────────────────────────────────────────────────
router.post('/tiebreaker/designate', async (req, res) => {
    const { gameId, description, week, season = (0, season_1.getCurrentNFLSeason)() } = req.body;
    if (!gameId || !week) {
        res.status(400).json({ error: 'gameId and week required' });
        return;
    }
    const game = await db_1.db.query.games.findFirst({ where: (0, drizzle_orm_1.eq)(schema.games.id, gameId) });
    if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
    }
    const [created] = await db_1.db.insert(schema.tiebreakerGames).values({
        season,
        week,
        gameId,
        description: description ?? `Week ${week} tiebreaker: predict combined score`,
    }).returning();
    res.status(201).json(created);
});
// ── Notification Testing ──────────────────────────────────────────────────────
router.get('/notifications/token-status', async (req, res) => {
    const userId = req.currentUser.id;
    const tokens = await db_1.db.query.pushTokens.findMany({
        where: (0, drizzle_orm_1.eq)(schema.pushTokens.userId, userId),
    });
    res.json({ hasToken: tokens.length > 0, tokenCount: tokens.length, userId });
});
router.post('/notifications/test', async (req, res) => {
    try {
        const userId = req.currentUser.id;
        const tokens = await db_1.db.query.pushTokens.findMany({
            where: (0, drizzle_orm_1.eq)(schema.pushTokens.userId, userId),
        });
        if (tokens.length === 0) {
            res.status(400).json({ error: 'No push token registered for this user. Open the app on your device and grant notification permission first.' });
            return;
        }
        const tickets = await (0, notificationService_1.sendPushToUsers)([userId], 'Test Notification 🏈', 'Push notifications are working!', { type: 'test' });
        res.json({ sent: true, tokenCount: tokens.length, tickets });
    }
    catch (err) {
        console.error('[Admin] notifications/test error:', err);
        res.status(500).json({ error: err?.message ?? 'Unknown error' });
    }
});
// Unambiguous check for whether RESEND_API_KEY actually reached this deployment -- never
// returns the key itself, just whether it's present, so "no email sent" can be diagnosed
// without guessing whether it's a missing-picks issue or a missing-env-var issue.
router.get('/email/status', async (req, res) => {
    res.json({ resendConfigured: !!process.env['RESEND_API_KEY'] });
});
// Send the calling admin their own current-week picks as a test email, without waiting
// for this week's real lock time. Falls back to whatever week actually has games for the admin's picks.
router.post('/email/test', async (req, res) => {
    try {
        const { sendWeeklyPicksEmails } = await Promise.resolve().then(() => __importStar(require('../services/emailService')));
        const { getCurrentWeekAndType, getCurrentNFLSeason } = await Promise.resolve().then(() => __importStar(require('../utils/season')));
        const { week, seasonType } = await getCurrentWeekAndType();
        const season = getCurrentNFLSeason();
        const sent = await sendWeeklyPicksEmails(week, season, seasonType, req.currentUser.id);
        if (sent === 0) {
            res.status(400).json({ error: `No picks found for you in ${seasonType} week ${week} — make a pick first, or check RESEND_API_KEY is set.` });
            return;
        }
        res.json({ sent, week, season, seasonType });
    }
    catch (err) {
        console.error('[Admin] email/test error:', err);
        res.status(500).json({ error: err?.message ?? 'Unknown error' });
    }
});
let scheduledTestTimeout = null;
let scheduledTestUserId = null;
router.post('/notifications/schedule-test', async (req, res) => {
    try {
        const userId = req.currentUser.id;
        const { delayMinutes } = req.body;
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
                await (0, notificationService_1.sendPushToUsers)([scheduledTestUserId], '1 hour left for picks! 🏈', 'Lock in your picks before they close. (Scheduled test)', { type: 'deadline_test' });
            }
            scheduledTestTimeout = null;
            scheduledTestUserId = null;
        }, delayMinutes * 60 * 1000);
        res.json({ scheduled: true, fireAt: fireAt.toISOString(), delayMinutes });
    }
    catch (err) {
        console.error('[Admin] notifications/schedule-test error:', err);
        res.status(500).json({ error: err?.message ?? 'Unknown error' });
    }
});
router.post('/notifications/broadcast', async (req, res) => {
    const { title, body, gridirons_only } = req.body;
    if (!title?.trim() || !body?.trim()) {
        res.status(400).json({ error: 'title and body are required' });
        return;
    }
    try {
        if (gridirons_only) {
            const gridirons = await db_1.db.query.users.findMany({ where: (0, drizzle_orm_1.eq)(schema.users.isGridiron, true) });
            const ids = gridirons.map(u => u.id);
            const tickets = await (0, notificationService_1.sendPushToUsers)(ids, title.trim(), body.trim(), { type: 'broadcast' });
            res.json({ ok: true, sent: ids.length, tickets });
        }
        else {
            await (0, notificationService_1.sendPushToAllUsers)(title.trim(), body.trim(), { type: 'broadcast' });
            res.json({ ok: true });
        }
    }
    catch (err) {
        console.error('[Admin] broadcast error:', err);
        res.status(500).json({ error: err?.message ?? 'Broadcast failed' });
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
// ── Feedback ──────────────────────────────────────────────────────────────────
router.get('/feedback', async (req, res) => {
    const items = await db_1.db.query.activityLog.findMany({
        where: (0, drizzle_orm_1.eq)(schema.activityLog.type, 'feedback'),
        orderBy: [(0, drizzle_orm_1.desc)(schema.activityLog.createdAt)],
    });
    res.json(items);
});
// ── Export ────────────────────────────────────────────────────────────────────
router.get('/export', async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const [allUsers, allGames, allPicks, allTrophies] = await Promise.all([
        db_1.db.query.users.findMany(),
        db_1.db.query.games.findMany({ where: (0, drizzle_orm_1.eq)(schema.games.season, season) }),
        db_1.db.query.picks.findMany(),
        db_1.db.query.trophies.findMany({ where: (0, drizzle_orm_1.eq)(schema.trophies.season, season) }),
    ]);
    res.json({ users: allUsers, games: allGames, picks: allPicks, trophies: allTrophies });
});
exports.default = router;
//# sourceMappingURL=admin.js.map