import { db } from '../db';
import { sql } from 'drizzle-orm';

// One-time DDL: a read-only view so Railway's DB browser (or any SQL client) shows the
// matchup and the actual team name picked next to each pick row, instead of just raw IDs.
// Not managed via drizzle-kit -- this is a convenience view for manual inspection, not part
// of the application's query path. Safe to re-run (CREATE OR REPLACE).
async function main() {
  console.log('Creating/replacing picks_readable view...');
  await db.execute(sql`
    CREATE OR REPLACE VIEW picks_readable AS
    SELECT
      p.id,
      p.created_at,
      u.team_name AS player_name,
      g.season,
      g.season_type,
      g.week,
      g.away_team,
      g.home_team,
      p.pick,
      CASE WHEN p.pick = 'home' THEN g.home_team ELSE g.away_team END AS picked_team,
      p.is_correct,
      p.pick_win_probability,
      p.user_id,
      p.game_id
    FROM picks p
    JOIN users u ON u.id = p.user_id
    JOIN games g ON g.id = p.game_id
  `);
  console.log('Done. Query it in Railway\'s DB browser or via SQL as: SELECT * FROM picks_readable ORDER BY created_at DESC;');
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to create view:', err);
  process.exit(1);
});
