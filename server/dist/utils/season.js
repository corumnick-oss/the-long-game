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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentNFLSeason = getCurrentNFLSeason;
exports.getCurrentWeekAndType = getCurrentWeekAndType;
exports.isForceRegularSeason = isForceRegularSeason;
exports.getNextWeekToUnlock = getNextWeekToUnlock;
exports.getCurrentNFLWeek = getCurrentNFLWeek;
exports.isPreseasonMode = isPreseasonMode;
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const lockTime_1 = require("./lockTime");
function getCurrentNFLSeason() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    // Flip to new season in March — after the Super Bowl, before preseason
    return month >= 3 ? year : year - 1;
}
async function firstGameTime(season, seasonType) {
    const { games } = await Promise.resolve().then(() => __importStar(require('../db/schema')));
    const { and, eq: eqOp, asc } = await Promise.resolve().then(() => __importStar(require('drizzle-orm')));
    const g = await db_1.db.query.games.findFirst({
        where: and(eqOp(games.season, season), eqOp(games.seasonType, seasonType), eqOp(games.sport, 'nfl')),
        orderBy: [asc(games.gameTime)],
    });
    return g?.gameTime ?? null;
}
// The current week for a season type is the first one whose picks aren't locked yet (still
// open, or about to open) -- naturally advances 1, 2, 3... as each week's lock time (see
// lockTime.ts -- the day before that week's earliest game, not always a Wednesday) passes.
// If every known week is already locked, stay on the last one rather than erroring.
async function firstUnlockedOrLastWeek(season, seasonType) {
    const { games } = await Promise.resolve().then(() => __importStar(require('../db/schema')));
    const { and, eq: eqOp } = await Promise.resolve().then(() => __importStar(require('drizzle-orm')));
    const rows = await db_1.db.query.games.findMany({
        where: and(eqOp(games.season, season), eqOp(games.seasonType, seasonType), eqOp(games.sport, 'nfl')),
        columns: { week: true },
    });
    if (rows.length === 0)
        return null;
    const weeks = [...new Set(rows.map(r => r.week))].sort((a, b) => a - b);
    for (const w of weeks) {
        if (!(await (0, lockTime_1.isWeekLocked)(w, season, seasonType)))
            return w;
    }
    return weeks[weeks.length - 1];
}
// The week the scheduler's Tuesday 6AM job (or a manual admin unlock) has most recently
// unlocked for a season type -- this is the single source of truth for "current week" below.
// Using it (instead of raw lock-time math against whatever weeks' games happen to already be
// synced) is what keeps the current week from jumping to next week the instant the current
// one's lock time passes -- since the full season schedule is pre-synced ahead of time, next
// week's games already exist with a computable (future) lock time well before Tuesday actually
// opens it, and lock-time math alone can't tell "not locked yet" apart from "not open yet".
async function maxUnlockedWeek(season, seasonType) {
    const rows = await db_1.db.query.unlockedWeeks.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.unlockedWeeks.season, season), (0, drizzle_orm_1.eq)(schema_1.unlockedWeeks.seasonType, seasonType)),
        columns: { week: true },
    });
    if (rows.length === 0)
        return null;
    return Math.max(...rows.map(r => r.week));
}
// Next week for the Tuesday 6AM job to sync/unlock: the earliest week (by number) that has
// games synced but isn't in unlocked_weeks yet. Falls back to staying on the last known week
// if every synced week is already unlocked (re-sync is harmless).
async function nextWeekToUnlock(season, seasonType) {
    const { games } = await Promise.resolve().then(() => __importStar(require('../db/schema')));
    const { eq: eqOp } = await Promise.resolve().then(() => __importStar(require('drizzle-orm')));
    const rows = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)(eqOp(games.season, season), eqOp(games.seasonType, seasonType), eqOp(games.sport, 'nfl')),
        columns: { week: true },
    });
    if (rows.length === 0)
        return null;
    const weeks = [...new Set(rows.map(r => r.week))].sort((a, b) => a - b);
    const unlockedRows = await db_1.db.query.unlockedWeeks.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.unlockedWeeks.season, season), (0, drizzle_orm_1.eq)(schema_1.unlockedWeeks.seasonType, seasonType)),
        columns: { week: true },
    });
    const unlockedSet = new Set(unlockedRows.map(r => r.week));
    // Never advance to the next week while the latest already-unlocked week is still open.
    // Without this, an early manual unlock of week N (e.g. opening Week 1 a few days ahead of
    // its lock) would let the next Tuesday 6AM job unlock week N+1 prematurely.
    if (unlockedSet.size > 0) {
        const maxUnlocked = Math.max(...unlockedSet);
        if (!(await (0, lockTime_1.isWeekLocked)(maxUnlocked, season, seasonType)))
            return maxUnlocked;
    }
    for (const w of weeks)
        if (!unlockedSet.has(w))
            return w;
    return weeks[weeks.length - 1];
}
async function determineSeasonType(season, now) {
    const regularStart = await firstGameTime(season, 'regular');
    if (regularStart && regularStart.getTime() <= now.getTime())
        return 'regular';
    // Also treat the regular season as active once an admin has actually unlocked a
    // regular-season week -- the "Unlock Week -> Week 1, Regular Season" tap is the deliberate
    // switchover, so notifications/scheduler follow it immediately instead of waiting for the
    // first kickoff.
    const regularUnlocked = await db_1.db.query.unlockedWeeks.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.unlockedWeeks.season, season), (0, drizzle_orm_1.eq)(schema_1.unlockedWeeks.seasonType, 'regular')),
    });
    return regularUnlocked ? 'regular' : 'preseason';
}
// Data-driven, not calendar-guessed: preseason week numbering doesn't line up with a fixed
// "first Thursday of August" rule (e.g. 2026's preseason "week 1" was a lone standalone Hall
// of Fame Game a full week before the real 16-game slate) -- so this reads whatever's actually
// synced into the DB instead of assuming a schedule shape.
//
// "Current week" only advances when the scheduler's Tuesday 6AM job (or a manual admin unlock)
// formally unlocks the next one (see maxUnlockedWeek above) -- never merely because the
// previous week's lock time passed.
async function getCurrentWeekAndType() {
    // Manual admin override (Admin -> app settings) always wins.
    const override = await db_1.db.query.appSettings.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.appSettings.key, 'currentWeek') });
    if (override)
        return { week: parseInt(override.value, 10), seasonType: 'regular' };
    const season = getCurrentNFLSeason();
    let seasonType = await determineSeasonType(season, new Date());
    // "Preseason is over" switch -- set via `npm run season:regular` (app_settings.forceRegularSeason).
    // Makes the app present the regular season even before Week 1 is unlocked or the first game
    // kicks off. The week is still computed normally below, so it auto-advances as weeks unlock
    // and this flag can be left on permanently (it's a no-op once the season truly starts).
    if (seasonType === 'preseason' && await isForceRegularSeason())
        seasonType = 'regular';
    const week = (await maxUnlockedWeek(season, seasonType)) ?? (await firstUnlockedOrLastWeek(season, seasonType)) ?? 1;
    return { week, seasonType };
}
async function isForceRegularSeason() {
    const setting = await db_1.db.query.appSettings.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_1.appSettings.key, 'forceRegularSeason'),
    });
    return setting?.value === 'true';
}
// Used only by the Tuesday 6AM scheduler job to determine which week to sync + unlock next --
// distinct from getCurrentWeekAndType() above, which reports whatever week is already open.
async function getNextWeekToUnlock() {
    const season = getCurrentNFLSeason();
    const seasonType = await determineSeasonType(season, new Date());
    const week = (await nextWeekToUnlock(season, seasonType)) ?? 1;
    return { week, seasonType };
}
// Backward-compatible wrapper for callers that only need the number.
async function getCurrentNFLWeek() {
    return (await getCurrentWeekAndType()).week;
}
async function isPreseasonMode() {
    const setting = await db_1.db.query.appSettings.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_1.appSettings.key, 'preseasonMode'),
    });
    return setting?.value === 'true';
}
//# sourceMappingURL=season.js.map