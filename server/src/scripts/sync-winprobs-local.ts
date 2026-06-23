import { syncWinProbabilities } from '../services/espnService.js';

async function main() {
  const week = parseInt(process.argv[2] ?? '1', 10);
  const season = parseInt(process.argv[3] ?? '2026', 10);

  console.log(`Syncing win probabilities: week=${week} season=${season}...`);
  const updated = await syncWinProbabilities(week, season);
  console.log(`Done. Updated ${updated} games.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Win prob sync failed:', err);
  process.exit(1);
});
