"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const espnService_js_1 = require("../services/espnService.js");
async function main() {
    const week = parseInt(process.argv[2] ?? '1', 10);
    const season = parseInt(process.argv[3] ?? '2026', 10);
    const seasonType = process.argv[4] ?? 'regular';
    console.log(`Syncing games: week=${week} season=${season} seasonType=${seasonType}...`);
    const count = await (0, espnService_js_1.syncWeekGames)(week, season, seasonType);
    console.log(`Done. Synced ${count} games.`);
    process.exit(0);
}
main().catch(err => {
    console.error('Game sync failed:', err);
    process.exit(1);
});
//# sourceMappingURL=sync-games-local.js.map