"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const schema = __importStar(require("../db/schema"));
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
        // Backfill box score stats for all completed games in the prior week
        await (0, espnService_1.backfillTeamStats)(season, 'regular');
        // Auto-unlock week in DB so the picks gate opens
        await db_1.db.insert(schema.unlockedWeeks)
            .values({ week, season, seasonType: 'regular', unlockedBy: 'scheduler' })
            .onConflictDoNothing();
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
// Wednesday 9PM PT — picks lock notification + apply default picks
node_cron_1.default.schedule('0 21 * * 3', async () => {
    try {
        const season = (0, season_1.getCurrentNFLSeason)();
        const week = await getActiveWeek();
        await (0, notificationService_1.notifyPicksLocked)(week);
        await (0, activity_1.logActivity)('picks_locked', `Week ${week} picks are locked. Good luck!`, 'global', { metadata: { week, season } });
        await applyDefaultPicks(week, season);
    }
    catch (err) {
        console.error('[Scheduler] Wednesday 9PM lock notification failed:', err);
    }
});
// Apply default picks for users who didn't pick all games.
// Default: Raiders if playing, otherwise away team.
async function applyDefaultPicks(week, season) {
    const RAIDERS_NAMES = new Set(['Las Vegas Raiders', 'LV']);
    try {
        const seasonType = 'regular';
        const weekGames = await db_1.db.query.games.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.games.week, week), (0, drizzle_orm_1.eq)(schema_1.games.season, season), (0, drizzle_orm_1.eq)(schema_1.games.sport, 'nfl'), (0, drizzle_orm_1.eq)(schema_1.games.seasonType, seasonType)),
        });
        if (weekGames.length === 0)
            return;
        const gameIds = weekGames.map(g => g.id);
        const allUsers = await db_1.db.query.users.findMany({ where: (0, drizzle_orm_1.eq)(schema.users.nflAccess, true) });
        const allPicks = await db_1.db.query.picks.findMany({ where: (0, drizzle_orm_1.inArray)(schema.picks.gameId, gameIds) });
        const pickMap = new Map();
        for (const pick of allPicks) {
            if (!pickMap.has(pick.userId))
                pickMap.set(pick.userId, new Set());
            pickMap.get(pick.userId).add(pick.gameId);
        }
        for (const user of allUsers) {
            const userPicked = pickMap.get(user.id) ?? new Set();
            const missing = weekGames.filter(g => !userPicked.has(g.id));
            if (missing.length === 0)
                continue;
            for (const game of missing) {
                const isRaidersHome = RAIDERS_NAMES.has(game.homeTeam);
                const isRaidersAway = RAIDERS_NAMES.has(game.awayTeam);
                const pick = isRaidersHome ? 'home' : isRaidersAway ? 'away' : 'away';
                await db_1.db.insert(schema.picks).values({
                    userId: user.id,
                    gameId: game.id,
                    pick,
                    pickWinProbability: game.winningTeamWinProb,
                }).onConflictDoNothing();
            }
            (0, notificationService_1.notifyDefaultPicksApplied)(user.id, missing.length, week).catch(err => console.error('[Scheduler] notifyDefaultPicksApplied failed for user', user.id, err));
            console.log(`[Scheduler] Applied ${missing.length} default pick(s) for user ${user.id}`);
        }
    }
    catch (err) {
        console.error('[Scheduler] applyDefaultPicks failed:', err);
    }
}
console.log('[Scheduler] All cron jobs registered (TZ=America/Los_Angeles)');
//# sourceMappingURL=scheduler.js.map