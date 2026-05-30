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
// GET /api/games?week=X&season=Y
router.get('/', auth_1.optionalAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const week = req.query['week'] ? parseInt(req.query['week'], 10) : undefined;
    const conditions = [(0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl')];
    if (week)
        conditions.push((0, drizzle_orm_1.eq)(schema.games.week, week));
    const gameList = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)(...conditions),
        orderBy: [(0, drizzle_orm_1.asc)(schema.games.gameTime)],
    });
    // Attach viewer's own picks if authenticated
    let myPicksMap = {};
    if (req.currentUser && week) {
        const myPicks = await db_1.db.query.picks.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.picks.userId, req.currentUser.id), ...gameList.map(g => (0, drizzle_orm_1.eq)(schema.picks.gameId, g.id)).slice(0, 1)),
        });
        // Fetch all my picks for these games
        const allMyPicks = await db_1.db.query.picks.findMany({
            where: (0, drizzle_orm_1.eq)(schema.picks.userId, req.currentUser.id),
        });
        myPicksMap = Object.fromEntries(allMyPicks.filter(p => gameList.some(g => g.id === p.gameId)).map(p => [p.gameId, p.pick]));
    }
    // Compute pick % after lock
    let pickPctMap = {};
    if (week && gameList.length > 0) {
        const locked = await (0, lockTime_1.isWeekLocked)(week, season);
        if (locked) {
            const gameIds = gameList.map(g => g.id);
            const allPicks = await db_1.db.query.picks.findMany({
                where: (0, drizzle_orm_1.inArray)(schema.picks.gameId, gameIds),
            });
            for (const game of gameList) {
                const gamePicks = allPicks.filter(p => p.gameId === game.id);
                const total = gamePicks.length;
                if (total === 0) {
                    pickPctMap[game.id] = { homePickPct: null, awayPickPct: null };
                }
                else {
                    const homeCount = gamePicks.filter(p => p.pick === 'home').length;
                    pickPctMap[game.id] = {
                        homePickPct: Math.round((homeCount / total) * 100),
                        awayPickPct: Math.round(((total - homeCount) / total) * 100),
                    };
                }
            }
        }
    }
    res.json(gameList.map(game => ({
        ...game,
        myPick: myPicksMap[game.id] ?? null,
        homePickPct: pickPctMap[game.id]?.homePickPct ?? null,
        awayPickPct: pickPctMap[game.id]?.awayPickPct ?? null,
    })));
});
// GET /api/games/:id
router.get('/:id', auth_1.optionalAuth, async (req, res) => {
    const game = await db_1.db.query.games.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.games.id, req.params['id']),
    });
    if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
    }
    const locked = await (0, lockTime_1.isWeekLocked)(game.week, game.season);
    let pickBreakdown = null;
    if (locked) {
        const gamePicks = await db_1.db.query.picks.findMany({
            where: (0, drizzle_orm_1.eq)(schema.picks.gameId, game.id),
        });
        const userIds = [...new Set(gamePicks.map(p => p.userId))];
        const usersData = userIds.length
            ? await db_1.db.query.users.findMany({ where: (0, drizzle_orm_1.and)(...userIds.map(id => (0, drizzle_orm_1.eq)(schema.users.id, id)).slice(0, 1)) })
            : [];
        // Re-fetch users properly
        const allUsers = await db_1.db.query.users.findMany();
        const usersMap = Object.fromEntries(allUsers.map(u => [u.id, u]));
        const homeCount = gamePicks.filter(p => p.pick === 'home').length;
        const awayCount = gamePicks.filter(p => p.pick === 'away').length;
        const total = gamePicks.length;
        pickBreakdown = {
            homePct: total ? Math.round((homeCount / total) * 100) : 0,
            awayPct: total ? Math.round((awayCount / total) * 100) : 0,
            picks: gamePicks.map(p => ({
                userId: p.userId,
                teamName: usersMap[p.userId]?.teamName ?? 'Unknown',
                profileImageUrl: usersMap[p.userId]?.profileImageUrl ?? null,
                pick: p.pick,
                isCorrect: p.isCorrect,
            })),
        };
    }
    // Always return viewer's own pick
    let myPick = null;
    if (req.currentUser) {
        const myPickRecord = await db_1.db.query.picks.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.picks.userId, req.currentUser.id), (0, drizzle_orm_1.eq)(schema.picks.gameId, game.id)),
        });
        myPick = myPickRecord?.pick ?? null;
    }
    res.json({ ...game, pickBreakdown, myPick, isLocked: locked });
});
exports.default = router;
//# sourceMappingURL=games.js.map