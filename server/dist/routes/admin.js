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
const activity_1 = require("./activity");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, auth_1.requireAdmin);
// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
    const allUsers = await db_1.db.query.users.findMany({ orderBy: [(0, drizzle_orm_1.asc)(schema.users.teamName)] });
    res.json(allUsers);
});
router.patch('/users/:id', async (req, res) => {
    const { isLongie, isAdmin, nflAccess, teamName } = req.body;
    const updates = { updatedAt: new Date() };
    if (isLongie !== undefined)
        updates.isLongie = Boolean(isLongie);
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
    const count = await (0, espnService_1.syncWeekGames)(week, season, seasonType);
    await (0, activity_1.logActivity)('admin_sync', `Admin synced ${count} games for Week ${week}`, 'admin', { metadata: { week, season } });
    res.json({ synced: count, week, season });
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
router.post('/games/sync-scores', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const week = parseInt(req.body.week, 10);
    const seasonType = req.body.seasonType ?? 'regular';
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    const count = await (0, espnService_1.syncWeekScores)(week, season, seasonType);
    res.json({ updated: count, week, season });
});
// ── Win Probabilities ─────────────────────────────────────────────────────────
router.post('/games/sync-probs', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const week = parseInt(req.body.week, 10);
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    await (0, espnService_1.syncWinProbabilities)(week, season);
    res.json({ ok: true, week, season });
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
// ── Unlock Week ───────────────────────────────────────────────────────────────
router.post('/unlock-week', async (req, res) => {
    const season = req.body.season ?? (0, season_1.getCurrentNFLSeason)();
    const week = parseInt(req.body.week, 10);
    if (!week) {
        res.status(400).json({ error: 'week required' });
        return;
    }
    await db_1.db.insert(schema.unlockedWeeks).values({ week, season, unlockedBy: req.currentUser.id }).onConflictDoNothing();
    await (0, activity_1.logActivity)('week_unlocked', `Week ${week} picks are now open!`, 'global', { metadata: { week, season } });
    res.json({ ok: true, week, season });
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
    const allowed = ['seasonStartDate', 'currentSeason', 'preseasonMode', 'currentWeek'];
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