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
// GET /api/leaderboard?type=season|weekly&week=X&season=Y&filter=gridirons|global
router.get('/', auth_1.optionalAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const type = req.query['type'] ?? 'season';
    const week = req.query['week'] ? parseInt(req.query['week'], 10) : undefined;
    const filter = req.query['filter'] ?? (req.currentUser?.isGridiron ? 'gridirons' : 'global');
    const seasonType = req.query['seasonType'] ?? 'regular';
    const isWeekly = type === 'weekly' && week != null;
    const gridironsOnly = filter === 'gridirons';
    const gameFilter = isWeekly
        ? (0, drizzle_orm_1.sql) `g.season = ${season} AND g.week = ${week} AND g.sport = 'nfl' AND g.season_type = ${seasonType}`
        : (0, drizzle_orm_1.sql) `g.season = ${season} AND g.sport = 'nfl' AND g.season_type = ${seasonType}`;
    const userFilter = gridironsOnly ? (0, drizzle_orm_1.sql) `u.is_gridiron = true` : (0, drizzle_orm_1.sql) `u.nfl_access = true`;
    // Join order: users → games (filtered) → picks
    // This ensures is_correct counts only apply to the filtered game set
    const result = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT
      u.id                  AS user_id,
      u.team_name,
      u.profile_image_url,
      u.is_gridiron,
      u.is_premium,
      u.is_admin,
      COALESCE(CAST(COUNT(CASE WHEN p.is_correct = true  THEN 1 END) AS INTEGER), 0) AS wins,
      COALESCE(CAST(COUNT(CASE WHEN p.is_correct = false THEN 1 END) AS INTEGER), 0) AS losses,
      COALESCE(CAST((
        SELECT COUNT(*) FROM trophies t
        WHERE t.user_id = u.id AND t.season = ${season} AND t.sport = 'nfl'
      ) AS INTEGER), 0) AS trophy_count
    FROM users u
    LEFT JOIN games g ON ${gameFilter}
    LEFT JOIN picks p ON p.user_id = u.id AND p.game_id = g.id
    WHERE ${userFilter}
    GROUP BY u.id, u.team_name, u.profile_image_url, u.is_gridiron, u.is_premium, u.is_admin
    HAVING COUNT(p.id) > 0
    ORDER BY wins DESC, losses ASC
  `);
    const rows = result.rows ?? result;
    const viewerId = req.currentUser?.id;
    // Weekly bonus opt-ins only matter (and are only shown) on the Gridirons-filtered weekly view
    let bonusUserIds = new Set();
    if (isWeekly && gridironsOnly) {
        const optins = await db_1.db.query.weeklyBonusOptins.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.weeklyBonusOptins.week, week), (0, drizzle_orm_1.eq)(schema.weeklyBonusOptins.season, season), (0, drizzle_orm_1.eq)(schema.weeklyBonusOptins.seasonType, seasonType)),
        });
        bonusUserIds = new Set(optins.map(o => o.userId));
    }
    // Add rank + picks different from viewer
    const entries = rows.map((row, idx) => {
        const wins = Number(row.wins);
        const losses = Number(row.losses);
        return {
            rank: idx + 1,
            userId: row.user_id,
            teamName: row.team_name,
            profileImageUrl: row.profile_image_url,
            isGridiron: row.is_gridiron,
            isPremium: row.is_premium,
            wins,
            losses,
            accuracy: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0,
            trophyCount: Number(row.trophy_count),
            isCurrentUser: row.user_id === viewerId,
            weeklyBonusOptIn: bonusUserIds.has(row.user_id),
        };
    });
    res.json({ type, week, season, filter, entries });
});
exports.default = router;
//# sourceMappingURL=leaderboard.js.map