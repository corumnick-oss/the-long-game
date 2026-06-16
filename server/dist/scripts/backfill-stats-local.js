"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const espnService_js_1 = require("../services/espnService.js");
async function main() {
    const season = parseInt(process.argv[2] ?? '2025', 10);
    const seasonType = process.argv[3] ?? 'regular';
    console.log(`Backfilling team stats: ${season} ${seasonType}...`);
    const synced = await (0, espnService_js_1.backfillTeamStats)(season, seasonType);
    console.log(`Done. Processed ${synced} games.`);
    process.exit(0);
}
main().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
//# sourceMappingURL=backfill-stats-local.js.map