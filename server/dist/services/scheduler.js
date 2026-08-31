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
exports.applyDefaultPicks = applyDefaultPicks;
const node_cron_1 = __importDefault(require("node-cron"));
const espnService_1 = require("./espnService");
const trophyService_1 = require("./trophyService");
const notificationService_1 = require("./notificationService");
const emailService_1 = require("./emailService");
const season_1 = require("../utils/season");
const lockTime_1 = require("../utils/lockTime");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const schema = __importStar(require("../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const activity_1 = require("../routes/activity");
const PT = { timezone: 'America/Los_Angeles' };
// Every 30 seconds — live score updates. updateLiveScores() itself finds games that should
// have started but aren't final yet, so this must run unconditionally — it's what bootstraps
// the pre→in transition in the first place, not just what keeps an already-live game updated.
node_cron_1.default.schedule('*/30 * * * * *', async () => {
    try {
        await (0, espnService_1.updateLiveScores)();
    }
    catch (err) {
        console.error('[Scheduler] Live score update failed:', err);
    }
});
// Tuesday 6AM PT — weekly transition: award trophies, sync new week games.
// seasonType is whatever getCurrentWeekAndType() actually finds active (preseason or
// regular) -- this now runs unconditionally instead of bailing on an admin toggle that
// was effectively always off, so preseason weeks advance automatically same as regular ones.
node_cron_1.default.schedule('0 6 * * 2', async () => {
    try {
        const season = (0, season_1.getCurrentNFLSeason)();
        const { week, seasonType } = await (0, season_1.getNextWeekToUnlock)();
        console.log(`[Scheduler] Tuesday 6AM: weekly transition for ${seasonType} Week ${week}`);
        // Nothing to do if this week is already unlocked -- every synced week is done, or an admin
        // unlocked it manually ahead of the cron. Bail before re-syncing / re-sending "week open".
        const alreadyUnlocked = await db_1.db.query.unlockedWeeks.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.unlockedWeeks.week, week), (0, drizzle_orm_1.eq)(schema.unlockedWeeks.season, season), (0, drizzle_orm_1.eq)(schema.unlockedWeeks.seasonType, seasonType)),
        });
        if (alreadyUnlocked) {
            console.log(`[Scheduler] Tuesday 6AM: ${seasonType} Week ${week} already unlocked — nothing to do`);
            return;
        }
        // Weekly Achievements ("trophies") are regular-season only for now.
        if (seasonType === 'regular' && week > 1)
            await (0, trophyService_1.awardWeeklyTrophies)(week - 1, season);
        // Week summary notification ("You went X-Y this week!") — unlike Achievements, this
        // fires for both preseason and regular season.
        if (week > 1) {
            const records = await (0, trophyService_1.getWeeklyRecords)(week - 1, season, seasonType);
            for (const record of records) {
                (0, notificationService_1.notifyWeekSummary)(record.userId, week - 1, seasonType, record.wins, record.losses).catch(err => console.error('[Scheduler] notifyWeekSummary failed for user', record.userId, err));
            }
        }
        // Sync new week's games from ESPN
        await (0, espnService_1.syncWeekGames)(week, season, seasonType);
        // Backfill box score stats for all completed games in the prior week
        await (0, espnService_1.backfillTeamStats)(season, seasonType);
        // Auto-unlock week in DB so the picks gate opens
        await db_1.db.insert(schema.unlockedWeeks)
            .values({ week, season, seasonType, unlockedBy: 'scheduler' })
            .onConflictDoNothing();
        // Notify users week is open
        await (0, notificationService_1.notifyWeekUnlocked)(week, seasonType, season);
        // Refresh win probabilities for the newly-opened week (regular season only — ESPN publishes
        // no predictor data for preseason). Goes through the Pi relay like every other ESPN call.
        if (seasonType === 'regular') {
            await (0, espnService_1.syncWinProbabilities)(week, season).catch(err => console.error('[Scheduler] Tuesday 6AM win-prob sync failed:', err));
        }
        await (0, activity_1.logActivity)('week_opened', `${seasonType === 'preseason' ? 'Preseason ' : ''}Week ${week} picks are now open!`, 'global', { metadata: { week, season, seasonType } });
    }
    catch (err) {
        console.error('[Scheduler] Tuesday 6AM job failed:', err);
    }
}, PT);
// Win probability refresh runs twice a week: once at the Tuesday 6AM weekly transition (folded
// into that job above, right after the new week opens) and once more Wednesday 5PM PT to pick
// up any line/projection movement before the lock. Regular season only — ESPN publishes no
// predictor data for preseason games (confirmed directly against their API). Admins can also
// trigger a sync any time via Admin -> NFL Tools -> "Sync Win Probabilities".
node_cron_1.default.schedule('0 17 * * 3', async () => {
    try {
        const season = (0, season_1.getCurrentNFLSeason)();
        const { week, seasonType } = await (0, season_1.getCurrentWeekAndType)();
        if (seasonType === 'regular')
            await (0, espnService_1.syncWinProbabilities)(week, season);
    }
    catch (err) {
        console.error('[Scheduler] Wednesday 5PM prob sync failed:', err);
    }
}, PT);
// Every 5 minutes — dynamic lock reminder + lock actions. Each week's real lock time is
// computed per-week (see lockTime.ts: 11:59PM Pacific the day before that week's earliest
// game), so this replaces what used to be a fixed Wednesday-only cron — a week whose earliest
// game is itself a Wednesday locks Tuesday night, and a Saturday-only week locks Friday night,
// and this check fires the right actions on whichever day that turns out to be.
//
// Checks every week that's been unlocked but not yet marked locked-processed (unlocked_weeks.
// lockProcessedAt), so it also self-heals: if the server was down when a week's lock time
// passed, the next tick still catches it and fires the actions exactly once (guarded by the
// reminderSentAt/lockProcessedAt columns), instead of silently skipping that week forever.
//
// unlocked_weeks has no unique constraint on (week, season, seasonType) -- onConflictDoNothing
// on the insert elsewhere in this file has never actually enforced one-row-per-week (confirmed:
// prod already has duplicate rows for the same week from repeated manual "Unlock Week" taps
// during testing). Deduping by that triple here is what keeps a duplicate row from causing the
// lock push / email to fire twice for the same real week.
node_cron_1.default.schedule('*/5 * * * *', async () => {
    try {
        const pending = await db_1.db.query.unlockedWeeks.findMany({
            where: (0, drizzle_orm_1.isNull)(schema.unlockedWeeks.lockProcessedAt),
        });
        const seenKeys = new Set();
        for (const row of pending) {
            const seasonType = row.seasonType;
            const key = `${row.week}|${row.season}|${seasonType}`;
            if (seenKeys.has(key))
                continue;
            seenKeys.add(key);
            const lockTime = await (0, lockTime_1.getWeekLockTime)(row.week, row.season, seasonType);
            if (!lockTime)
                continue;
            const now = new Date();
            const alreadyLocked = now >= lockTime;
            const reminderThreshold = new Date(lockTime.getTime() - 4 * 60 * 60 * 1000);
            const rowMatch = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.unlockedWeeks.week, row.week), (0, drizzle_orm_1.eq)(schema.unlockedWeeks.season, row.season), (0, drizzle_orm_1.eq)(schema.unlockedWeeks.seasonType, seasonType));
            // Skip the "lock tonight" reminder entirely if we're already past lock time (e.g. after
            // extended downtime) — no point warning about a deadline that's already passed.
            if (!row.reminderSentAt && !alreadyLocked && now >= reminderThreshold) {
                await (0, notificationService_1.notifyDeadlineApproaching)(row.week, seasonType);
                await db_1.db.update(schema.unlockedWeeks).set({ reminderSentAt: new Date() }).where(rowMatch);
            }
            if (alreadyLocked) {
                await (0, notificationService_1.notifyPicksLocked)(row.week, seasonType);
                await (0, activity_1.logActivity)('picks_locked', `${seasonType === 'preseason' ? 'Preseason ' : ''}Week ${row.week} picks are locked. Good luck!`, 'global', { metadata: { week: row.week, season: row.season, seasonType } });
                await applyDefaultPicks(row.week, row.season, seasonType);
                // Proof-of-picks email, sent after default picks so it reflects each user's final state.
                (0, emailService_1.sendWeeklyPicksEmails)(row.week, row.season, seasonType).catch(err => console.error('[Scheduler] sendWeeklyPicksEmails failed:', err));
                // Marks every row sharing this (week, season, seasonType), not just this one — see note
                // above about duplicate rows.
                await db_1.db.update(schema.unlockedWeeks).set({ lockProcessedAt: new Date() }).where(rowMatch);
            }
        }
    }
    catch (err) {
        console.error('[Scheduler] Lock check failed:', err);
    }
}, PT);
// Apply default picks for users who didn't pick all games.
// Default: Raiders if playing, otherwise away team.
// Only runs if the week is unlocked for the given seasonType.
async function applyDefaultPicks(week, season, seasonType) {
    const RAIDERS_NAMES = new Set(['Las Vegas Raiders', 'LV']);
    try {
        const unlocked = await db_1.db.query.unlockedWeeks.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.unlockedWeeks.week, week), (0, drizzle_orm_1.eq)(schema.unlockedWeeks.season, season), (0, drizzle_orm_1.eq)(schema.unlockedWeeks.seasonType, seasonType)),
        });
        if (!unlocked) {
            console.log(`[Scheduler] applyDefaultPicks: ${seasonType} week ${week} season ${season} not unlocked — skipping`);
            return;
        }
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
        // Only default-pick users who already completed at least one OTHER week of THIS season
        // type -- a player's very first active regular-season week is never auto-filled, even for
        // games they forgot, and preseason picks do NOT count (preseason is its own thing; the
        // regular season starts everyone fresh). So someone who never really plays doesn't get
        // carried all year on Raiders/away-team defaults alone.
        const seasonPicks = await db_1.db.select({ userId: schema.picks.userId, week: schema_1.games.week })
            .from(schema.picks)
            .innerJoin(schema_1.games, (0, drizzle_orm_1.eq)(schema_1.games.id, schema.picks.gameId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.games.season, season), (0, drizzle_orm_1.eq)(schema_1.games.sport, 'nfl'), (0, drizzle_orm_1.eq)(schema_1.games.seasonType, seasonType)));
        const priorWeekPickUserIds = new Set(seasonPicks.filter(p => p.week !== week).map(p => p.userId));
        for (const user of allUsers) {
            if (!priorWeekPickUserIds.has(user.id))
                continue;
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
                await db_1.db.insert(schema.pickAuditLog).values({
                    userId: user.id, gameId: game.id, action: 'default_applied',
                    previousPick: null, newPick: pick,
                });
            }
            (0, notificationService_1.notifyDefaultPicksApplied)(user.id, missing.length, week, seasonType).catch(err => console.error('[Scheduler] notifyDefaultPicksApplied failed for user', user.id, err));
            console.log(`[Scheduler] Applied ${missing.length} default pick(s) for user ${user.id} (${seasonType})`);
        }
    }
    catch (err) {
        console.error('[Scheduler] applyDefaultPicks failed:', err);
    }
}
console.log('[Scheduler] All cron jobs registered (America/Los_Angeles)');
//# sourceMappingURL=scheduler.js.map