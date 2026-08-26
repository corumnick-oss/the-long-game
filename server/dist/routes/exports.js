"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const exportTokens_1 = require("../services/exportTokens");
const router = (0, express_1.Router)();
function csvField(v) {
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
}
// GET /api/exports/picks.csv?token=X — token-authenticated (not Bearer-auth), so it can be
// opened directly in a system browser from a link minted by POST /api/admin/export-week-picks-token.
router.get('/picks.csv', async (req, res) => {
    const token = req.query['token'];
    const payload = token ? (0, exportTokens_1.consumeExportToken)(token) : null;
    if (!payload) {
        res.status(401).send('This export link is invalid or has expired. Generate a new one from the admin Data tab.');
        return;
    }
    const { week, season, seasonType } = payload;
    const result = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT
      u.team_name AS player,
      g.away_team, g.home_team,
      CASE WHEN p.pick = 'home' THEN g.home_team WHEN p.pick = 'away' THEN g.away_team END AS picked_team,
      p.is_correct,
      g.status,
      to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"') AS picked_at
    FROM picks p
    JOIN users u ON u.id = p.user_id
    JOIN games g ON g.id = p.game_id
    WHERE g.season = ${season} AND g.week = ${week} AND g.season_type = ${seasonType}
      AND g.sport = 'nfl' AND u.is_gridiron = true
    ORDER BY u.team_name, g.game_time
  `);
    const rows = (result.rows ?? result);
    const header = ['Player', 'Away Team', 'Home Team', 'Picked', 'Result', 'Picked At (UTC)'];
    const lines = [header.map(csvField).join(',')];
    for (const r of rows) {
        // is_correct stays null both for an ungraded (not-yet-final) game and for a genuine tie —
        // game status is what actually distinguishes "hasn't happened yet" from "ended tied".
        const outcome = r.is_correct === true ? 'Correct' : r.is_correct === false ? 'Incorrect' : r.status === 'post' ? 'Tie' : 'Pending';
        lines.push([r.player, r.away_team, r.home_team, r.picked_team, outcome, r.picked_at].map(csvField).join(','));
    }
    const csv = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gridirons-week-${week}-${seasonType}-${season}-picks.csv"`);
    res.send(csv);
});
exports.default = router;
//# sourceMappingURL=exports.js.map