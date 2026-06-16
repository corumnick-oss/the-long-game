import { backfillTeamStats } from '../services/espnService.js';

async function main() {
  const season = parseInt(process.argv[2] ?? '2025', 10);
  const seasonType = process.argv[3] ?? 'regular';

  console.log(`Backfilling team stats: ${season} ${seasonType}...`);
  const synced = await backfillTeamStats(season, seasonType);
  console.log(`Done. Processed ${synced} games.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
