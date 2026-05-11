"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const espnService_1 = require("./espnService");
const trophyService_1 = require("./trophyService");
const notificationService_1 = require("./notificationService");
const season_1 = require("../utils/season");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const activity_1 = require("../routes/activity");
async function getActiveWeek() {
    return (0, season_1.getCurrentNFLWeek)();
}
// Every 30 seconds — live score updates (only during active games)
node_cron_1.default.schedule('*/30 * * * * *', async () => {
    try {
        const liveGames = await db_1.db.query.games.findMany({ where: (0, drizzle_orm_1.eq)(schema_1.games.status, 'in') });
        if (liveGames.length > 0)
            await (0, espnService_1.updateLiveScores)();
    }
    catch (err) {
        console.error('[Scheduler] Live score update failed:', err);
    }
});
// Tuesday 6AM PT — weekly transition: award trophies, sync new week games
// With TZ=America/Los_Angeles on Railway, this cron runs in local time
node_cron_1.default.schedule('0 6 * * 2', async () => {
    try {
        if (await (0, season_1.isPreseasonMode)())
            return;
        const season = (0, season_1.getCurrentNFLSeason)();
        const week = await getActiveWeek();
        console.log(`[Scheduler] Tuesday 6AM: weekly transition for Week ${week}`);
        // Award trophies for completed week
        if (week > 1)
            await (0, trophyService_1.awardWeeklyTrophies)(week - 1, season);
        // Sync new week's games from ESPN
        await (0, espnService_1.syncWeekGames)(week, season, 'regular');
        // Notify users week is open
        await (0, notificationService_1.notifyWeekUnlocked)(week);
        await (0, activity_1.logActivity)('week_opened', `Week ${week} picks are now open!`, 'global', { metadata: { week, season } });
    }
    catch (err) {
        console.error('[Scheduler] Tuesday 6AM job failed:', err);
    }
});
// Tuesday 9PM PT — win probability refresh
node_cron_1.default.schedule('0 21 * * 2', async () => {
    try {
        const season = (0, season_1.getCurrentNFLSeason)();
        const week = await getActiveWeek();
        await (0, espnService_1.syncWinProbabilities)(week, season);
    }
    catch (err) {
        console.error('[Scheduler] Tuesday 9PM prob sync failed:', err);
    }
});
// Wednesday 6AM PT — win probability refresh
node_cron_1.default.schedule('0 6 * * 3', async () => {
    try {
        const season = (0, season_1.getCurrentNFLSeason)();
        const week = await getActiveWeek();
        await (0, espnService_1.syncWinProbabilities)(week, season);
    }
    catch (err) {
        console.error('[Scheduler] Wednesday 6AM prob sync failed:', err);
    }
});
// Wednesday 5PM PT — win probability refresh
node_cron_1.default.schedule('0 17 * * 3', async () => {
    try {
        const season = (0, season_1.getCurrentNFLSeason)();
        const week = await getActiveWeek();
        await (0, espnService_1.syncWinProbabilities)(week, season);
    }
    catch (err) {
        console.error('[Scheduler] Wednesday 5PM prob sync failed:', err);
    }
});
// Wednesday 8PM PT — 1 hour warning
node_cron_1.default.schedule('0 20 * * 3', async () => {
    try {
        const week = await getActiveWeek();
        await (0, notificationService_1.notifyDeadlineApproaching)(week);
    }
    catch (err) {
        console.error('[Scheduler] Wednesday 8PM warning failed:', err);
    }
});
// Wednesday 9PM PT — picks lock notification
node_cron_1.default.schedule('0 21 * * 3', async () => {
    try {
        const season = (0, season_1.getCurrentNFLSeason)();
        const week = await getActiveWeek();
        await (0, notificationService_1.notifyPicksLocked)(week);
        await (0, activity_1.logActivity)('picks_locked', `Week ${week} picks are locked. Good luck!`, 'global', { metadata: { week, season } });
    }
    catch (err) {
        console.error('[Scheduler] Wednesday 9PM lock notification failed:', err);
    }
});
console.log('[Scheduler] All cron jobs registered (TZ=America/Los_Angeles)');
//# sourceMappingURL=scheduler.js.map