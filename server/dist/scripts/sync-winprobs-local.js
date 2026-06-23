"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const espnService_js_1 = require("../services/espnService.js");
async function main() {
    const week = parseInt(process.argv[2] ?? '1', 10);
    const season = parseInt(process.argv[3] ?? '2026', 10);
    console.log(`Syncing win probabilities: week=${week} season=${season}...`);
    const updated = await (0, espnService_js_1.syncWinProbabilities)(week, season);
    console.log(`Done. Updated ${updated} games.`);
    process.exit(0);
}
main().catch(err => {
    console.error('Win prob sync failed:', err);
    process.exit(1);
});
//# sourceMappingURL=sync-winprobs-local.js.map