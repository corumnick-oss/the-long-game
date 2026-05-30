"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const season_1 = require("../utils/season");
const router = (0, express_1.Router)();
// GET /api/leaderboard?type=season|weekly&week=X&season=Y&filter=longies|global
router.get('/', auth_1.optionalAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const type = req.query['type'] ?? 'season';
    const week = req.query['week'] ? parseInt(req.query['week'], 10) : undefined;
    const filter = req.query['filter'] ?? (req.currentUser?.isLongie ? 'longies' : 'global');
    const isWeekly = type === 'weekly' && week != null;
    const longiesOnly = filter === 'longies';
    const gameFilter = isWeekly
        ? (0, drizzle_orm_1.sql) `g.season = ${season} AND g.week = ${week} AND g.sport = 'nfl'`
        : (0, drizzle_orm_1.sql) `g.season = ${season} AND g.sport = 'nfl'`;
    const userFilter = longiesOnly ? (0, drizzle_orm_1.sql) `u.is_longie = true` : (0, drizzle_orm_1.sql) `u.nfl_access = true`;
    // Join order: users → games (filtered) → picks
    // This ensures is_correct counts only apply to the filtered game set
    const result = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT
      u.id                  AS user_id,
      u.team_name,
      u.profile_image_url,
      u.is_longie,
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
    GROUP BY u.id, u.team_name, u.profile_image_url, u.is_longie, u.is_premium, u.is_admin
    ORDER BY wins DESC, losses ASC
  `);
    const rows = result.rows ?? result;
    const viewerId = req.currentUser?.id;
    // Add rank + picks different from viewer
    const entries = rows.map((row, idx) => {
        const wins = Number(row.wins);
        const losses = Number(row.losses);
        return {
            rank: idx + 1,
            userId: row.user_id,
            teamName: row.team_name,
            profileImageUrl: row.profile_image_url,
            isLongie: row.is_longie,
            isPremium: row.is_premium,
            wins,
            losses,
            accuracy: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0,
            trophyCount: Number(row.trophy_count),
            isCurrentUser: row.user_id === viewerId,
        };
    });
    res.json({ type, week, season, filter, entries });
});
exports.default = router;
//# sourceMappingURL=leaderboard.js.map