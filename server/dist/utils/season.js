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
// open, or about to open) -- naturally advances 1, 2, 3... as each week's Wednesday 9PM lock
// passes. If every known week is already locked, stay on the last one rather than erroring.
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
// Data-driven, not calendar-guessed: preseason week numbering doesn't line up with a fixed
// "first Thursday of August" rule (e.g. 2026's preseason "week 1" was a lone standalone Hall
// of Fame Game a full week before the real 16-game slate) -- so this reads whatever's actually
// synced into the DB instead of assuming a schedule shape.
async function getCurrentWeekAndType() {
    // Manual admin override (Admin -> app settings) always wins.
    const override = await db_1.db.query.appSettings.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.appSettings.key, 'currentWeek') });
    if (override)
        return { week: parseInt(override.value, 10), seasonType: 'regular' };
    const season = getCurrentNFLSeason();
    const now = new Date();
    const regularStart = await firstGameTime(season, 'regular');
    const regularHasBegun = !!regularStart && regularStart.getTime() <= now.getTime();
    const seasonType = regularHasBegun ? 'regular' : 'preseason';
    const week = (await firstUnlockedOrLastWeek(season, seasonType)) ?? 1;
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