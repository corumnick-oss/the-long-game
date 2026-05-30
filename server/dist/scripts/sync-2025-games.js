"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const espnService_js_1 = require("../services/espnService.js");
async function main() {
    console.log('Syncing all 18 weeks of 2025 NFL season from ESPN...\n');
    let total = 0;
    for (let week = 1; week <= 18; week++) {
        try {
            const count = await (0, espnService_js_1.syncWeekGames)(week, 2025, 'regular');
            console.log(`  Week ${week}: ${count} games`);
            total += count;
        }
        catch (err) {
            console.error(`  Week ${week}: FAILED —`, err.message);
        }
    }
    console.log(`\nDone. ${total} games synced.`);
    process.exit(0);
}
main().catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
});
//# sourceMappingURL=sync-2025-games.js.map