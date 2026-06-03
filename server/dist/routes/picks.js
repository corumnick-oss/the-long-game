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
const lockTime_1 = require("../utils/lockTime");
const season_1 = require("../utils/season");
const router = (0, express_1.Router)();
// GET /api/picks?week=X&season=Y  — always returns only the requesting user's own picks
router.get('/', auth_1.requireAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const week = req.query['week'] ? parseInt(req.query['week'], 10) : undefined;
    let gameIds;
    if (week) {
        const weekGames = await db_1.db.query.games.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.games.week, week), (0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl')),
        });
        gameIds = weekGames.map(g => g.id);
    }
    const conditions = [(0, drizzle_orm_1.eq)(schema.picks.userId, req.currentUser.id)];
    if (gameIds?.length)
        conditions.push((0, drizzle_orm_1.inArray)(schema.picks.gameId, gameIds));
    const myPicks = await db_1.db.query.picks.findMany({ where: (0, drizzle_orm_1.and)(...conditions) });
    res.json(myPicks);
});
// GET /api/picks/week — full grid of all Longie picks (only after lock)
router.get('/week', auth_1.requireAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const week = parseInt(req.query['week'], 10);
    if (!week) {
        res.status(400).json({ error: 'week is required' });
        return;
    }
    const locked = await (0, lockTime_1.isWeekLocked)(week, season);
    const weekGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.games.week, week), (0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl')),
        orderBy: [(0, drizzle_orm_1.asc)(schema.games.gameTime)],
    });
    if (!locked) {
        res.json({ locked: false, week, season, games: weekGames.map(g => ({
                id: g.id, homeTeam: g.homeTeam, awayTeam: g.awayTeam,
                homeTeamLogo: g.homeTeamLogo, awayTeamLogo: g.awayTeamLogo,
                homeScore: g.homeScore, awayScore: g.awayScore, status: g.status,
            })), users: [], picksByUser: {} });
        return;
    }
    const gameIds = weekGames.map(g => g.id);
    const [longies, allPicks] = await Promise.all([
        db_1.db.query.users.findMany({ where: (0, drizzle_orm_1.eq)(schema.users.isLongie, true) }),
        gameIds.length
            ? db_1.db.query.picks.findMany({ where: (0, drizzle_orm_1.inArray)(schema.picks.gameId, gameIds) })
            : Promise.resolve([]),
    ]);
    // picksByUser[userId][gameId] = { pick, isCorrect }
    const picksByUser = {};
    for (const p of allPicks) {
        if (!picksByUser[p.userId])
            picksByUser[p.userId] = {};
        picksByUser[p.userId][p.gameId] = { pick: p.pick, isCorrect: p.isCorrect ?? null };
    }
    res.json({
        locked: true,
        week,
        season,
        games: weekGames.map(g => ({
            id: g.id,
            homeTeam: g.homeTeam,
            awayTeam: g.awayTeam,
            homeTeamLogo: g.homeTeamLogo,
            awayTeamLogo: g.awayTeamLogo,
            homeScore: g.homeScore,
            awayScore: g.awayScore,
            status: g.status,
        })),
        users: longies.map(u => ({
            id: u.id,
            teamName: u.teamName,
            profileImageUrl: u.profileImageUrl,
        })),
        picksByUser,
    });
});
// GET /api/picks/by-team?season=X  — caller's W-L record grouped by team picked
router.get('/by-team', auth_1.requireAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const seasonGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl')),
    });
    if (!seasonGames.length) {
        res.json([]);
        return;
    }
    const gameIds = seasonGames.map(g => g.id);
    const userPicks = await db_1.db.query.picks.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.picks.userId, req.currentUser.id), (0, drizzle_orm_1.inArray)(schema.picks.gameId, gameIds)),
    });
    const gamesMap = Object.fromEntries(seasonGames.map(g => [g.id, g]));
    const byTeam = {};
    for (const pick of userPicks) {
        if (pick.isCorrect === null)
            continue; // unsettled game
        const game = gamesMap[pick.gameId];
        if (!game)
            continue;
        const teamName = pick.pick === 'home' ? game.homeTeam : game.awayTeam;
        const logo = pick.pick === 'home' ? game.homeTeamLogo : game.awayTeamLogo;
        if (!byTeam[teamName])
            byTeam[teamName] = { wins: 0, losses: 0, logo: logo ?? null };
        if (pick.isCorrect)
            byTeam[teamName].wins++;
        else
            byTeam[teamName].losses++;
    }
    const result = Object.entries(byTeam).map(([team, stats]) => ({
        team,
        wins: stats.wins,
        losses: stats.losses,
        logo: stats.logo,
        total: stats.wins + stats.losses,
        accuracy: stats.wins + stats.losses > 0
            ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
            : 0,
    })).sort((a, b) => b.total - a.total);
    res.json(result);
});
// POST /api/picks  — submit or update a pick (before lock)
router.post('/', auth_1.requireAuth, async (req, res) => {
    const { gameId, pick } = req.body;
    if (!gameId || !pick || !['home', 'away'].includes(pick)) {
        res.status(400).json({ error: 'gameId and pick (home|away) are required' });
        return;
    }
    const game = await db_1.db.query.games.findFirst({ where: (0, drizzle_orm_1.eq)(schema.games.id, gameId) });
    if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
    }
    const locked = await (0, lockTime_1.isWeekLocked)(game.week, game.season);
    if (locked) {
        res.status(403).json({ error: 'Picks are locked for this week' });
        return;
    }
    // Upsert — user can change pick before lock
    const existing = await db_1.db.query.picks.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.picks.userId, req.currentUser.id), (0, drizzle_orm_1.eq)(schema.picks.gameId, gameId)),
    });
    if (existing) {
        await db_1.db.update(schema.picks).set({ pick }).where((0, drizzle_orm_1.eq)(schema.picks.id, existing.id));
        res.json({ ...existing, pick });
    }
    else {
        const [newPick] = await db_1.db.insert(schema.picks).values({
            userId: req.currentUser.id,
            gameId,
            pick,
            pickWinProbability: game.winningTeamWinProb,
        }).returning();
        res.status(201).json(newPick);
    }
});
// DELETE /api/picks/:id — remove a pick before lock
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    const pick = await db_1.db.query.picks.findFirst({ where: (0, drizzle_orm_1.eq)(schema.picks.id, req.params['id']) });
    if (!pick) {
        res.status(404).json({ error: 'Pick not found' });
        return;
    }
    if (pick.userId !== req.currentUser.id) {
        res.status(403).json({ error: 'Not your pick' });
        return;
    }
    const game = await db_1.db.query.games.findFirst({ where: (0, drizzle_orm_1.eq)(schema.games.id, pick.gameId) });
    if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
    }
    const locked = await (0, lockTime_1.isWeekLocked)(game.week, game.season);
    if (locked) {
        res.status(403).json({ error: 'Picks are locked' });
        return;
    }
    await db_1.db.delete(schema.picks).where((0, drizzle_orm_1.eq)(schema.picks.id, pick.id));
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=picks.js.map