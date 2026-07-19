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
const router = (0, express_1.Router)();
// GET /api/trophies?userId=X&season=Y&week=X
router.get('/', auth_1.optionalAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const userId = req.query['userId'];
    const week = req.query['week'] ? parseInt(req.query['week'], 10) : undefined;
    const conditions = [(0, drizzle_orm_1.eq)(schema.trophies.season, season), (0, drizzle_orm_1.eq)(schema.trophies.sport, 'nfl')];
    if (userId)
        conditions.push((0, drizzle_orm_1.eq)(schema.trophies.userId, userId));
    if (week)
        conditions.push((0, drizzle_orm_1.eq)(schema.trophies.week, week));
    const result = await db_1.db.query.trophies.findMany({
        where: (0, drizzle_orm_1.and)(...conditions),
        orderBy: [(0, drizzle_orm_1.desc)(schema.trophies.earnedAt)],
    });
    res.json(result);
});
// GET /api/trophies/season?userId=X — all-time season podium trophies for a user
router.get('/season', auth_1.optionalAuth, async (req, res) => {
    const userId = req.query['userId'];
    if (!userId) {
        res.status(400).json({ error: 'userId required' });
        return;
    }
    const result = await db_1.db.query.seasonTrophies.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.seasonTrophies.userId, userId), (0, drizzle_orm_1.eq)(schema.seasonTrophies.sport, 'nfl')),
        orderBy: [(0, drizzle_orm_1.desc)(schema.seasonTrophies.season)],
    });
    res.json(result);
});
exports.default = router;
//# sourceMappingURL=trophies.js.map