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
const season_1 = require("../utils/season");
const lockTime_1 = require("../utils/lockTime");
const router = (0, express_1.Router)();
// GET /api/tiebreaker?week=X&season=Y
router.get('/', auth_1.requireAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const week = req.query['week'] ? parseInt(req.query['week'], 10) : undefined;
    const conditions = [(0, drizzle_orm_1.eq)(schema.tiebreakerGames.season, season)];
    if (week)
        conditions.push((0, drizzle_orm_1.eq)(schema.tiebreakerGames.week, week));
    const tbGame = await db_1.db.query.tiebreakerGames.findFirst({ where: (0, drizzle_orm_1.and)(...conditions) });
    if (!tbGame) {
        res.json(null);
        return;
    }
    const game = await db_1.db.query.games.findFirst({ where: (0, drizzle_orm_1.eq)(schema.games.id, tbGame.gameId) });
    // Get viewer's pick
    const myPick = await db_1.db.query.tiebreakerPicks.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.tiebreakerPicks.userId, req.currentUser.id), (0, drizzle_orm_1.eq)(schema.tiebreakerPicks.tiebreakerGameId, tbGame.id)),
    });
    // After lock, show all Longie picks
    const locked = await (0, lockTime_1.isWeekLocked)(tbGame.week, season);
    let allPicks = null;
    if (locked) {
        allPicks = await db_1.db.query.tiebreakerPicks.findMany({
            where: (0, drizzle_orm_1.eq)(schema.tiebreakerPicks.tiebreakerGameId, tbGame.id),
        });
    }
    res.json({ tiebreakerGame: tbGame, game, myPick, allPicks, isLocked: locked });
});
// POST /api/tiebreaker — submit or update
router.post('/', auth_1.requireAuth, async (req, res) => {
    const { tiebreakerGameId, predictedTotal } = req.body;
    if (!tiebreakerGameId || predictedTotal == null) {
        res.status(400).json({ error: 'tiebreakerGameId and predictedTotal required' });
        return;
    }
    const tbGame = await db_1.db.query.tiebreakerGames.findFirst({ where: (0, drizzle_orm_1.eq)(schema.tiebreakerGames.id, tiebreakerGameId) });
    if (!tbGame) {
        res.status(404).json({ error: 'Tiebreaker game not found' });
        return;
    }
    const locked = await (0, lockTime_1.isWeekLocked)(tbGame.week, tbGame.season);
    if (locked) {
        res.status(403).json({ error: 'Picks are locked' });
        return;
    }
    const existing = await db_1.db.query.tiebreakerPicks.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.tiebreakerPicks.userId, req.currentUser.id), (0, drizzle_orm_1.eq)(schema.tiebreakerPicks.tiebreakerGameId, tiebreakerGameId)),
    });
    if (existing) {
        const [updated] = await db_1.db.update(schema.tiebreakerPicks).set({ predictedTotal, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema.tiebreakerPicks.id, existing.id)).returning();
        res.json(updated);
    }
    else {
        const [created] = await db_1.db.insert(schema.tiebreakerPicks).values({
            userId: req.currentUser.id,
            tiebreakerGameId,
            season: tbGame.season,
            predictedTotal,
        }).returning();
        res.status(201).json(created);
    }
});
exports.default = router;
//# sourceMappingURL=tiebreaker.js.map