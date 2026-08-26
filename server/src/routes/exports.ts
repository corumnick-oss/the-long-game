import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { consumeExportToken } from '../services/exportTokens';

const router = Router();

function csvField(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

// GET /api/exports/picks.csv?token=X — token-authenticated (not Bearer-auth), so it can be
// opened directly in a system browser from a link minted by POST /api/admin/export-week-picks-token.
router.get('/picks.csv', async (req, res) => {
  const token = req.query['token'] as string | undefined;
  const payload = token ? consumeExportToken(token) : null;
  if (!payload) {
    res.status(401).send('This export link is invalid or has expired. Generate a new one from the admin Data tab.');
    return;
  }

  const { week, season, seasonType } = payload;

  const result = await db.execute(sql`
    SELECT
      u.team_name AS player,
      g.away_team, g.home_team,
      CASE WHEN p.pick = 'home' THEN g.home_team WHEN p.pick = 'away' THEN g.away_team END AS picked_team,
      p.is_correct,
      to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"') AS picked_at
    FROM picks p
    JOIN users u ON u.id = p.user_id
    JOIN games g ON g.id = p.game_id
    WHERE g.season = ${season} AND g.week = ${week} AND g.season_type = ${seasonType}
      AND g.sport = 'nfl' AND u.is_gridiron = true
    ORDER BY u.team_name, g.game_time
  `);
  const rows = ((result as any).rows ?? result) as any[];

  const header = ['Player', 'Away Team', 'Home Team', 'Picked', 'Result', 'Picked At (UTC)'];
  const lines = [header.map(csvField).join(',')];
  for (const r of rows) {
    const outcome = r.is_correct === true ? 'Correct' : r.is_correct === false ? 'Incorrect' : 'Tie/Pending';
    lines.push([r.player, r.away_team, r.home_team, r.picked_team, outcome, r.picked_at].map(csvField).join(','));
  }
  const csv = lines.join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="gridirons-week-${week}-${seasonType}-${season}-picks.csv"`);
  res.send(csv);
});

export default router;
