"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeekLockTime = getWeekLockTime;
exports.isWeekLocked = isWeekLocked;
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const PACIFIC_TZ = 'America/Los_Angeles';
// Converts a Y/M/D + hour:minute *wall clock time in America/Los_Angeles* into the
// correct UTC instant, correctly accounting for PST/PDT (DST changes twice a season).
function pacificWallTimeToUtc(year, month, day, hour, minute) {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: PACIFIC_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(utcGuess).map(p => [p.type, p.value]));
    const hourNum = parts.hour === '24' ? 0 : Number(parts.hour);
    const asIfUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hourNum, Number(parts.minute));
    const diff = utcGuess.getTime() - asIfUtc;
    return new Date(utcGuess.getTime() + diff);
}
// Reads the Y/M/D of a UTC instant as it falls on the Pacific calendar.
function getPacificDateParts(date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}
// Wednesday 9PM America/Los_Angeles. DST-aware — do not replace with fixed UTC offset math.
async function getWeekLockTime(week, season, seasonType = 'regular') {
    const setting = await db_1.db.query.weekSettings.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.weekSettings.week, week), (0, drizzle_orm_1.eq)(schema_1.weekSettings.season, season), (0, drizzle_orm_1.eq)(schema_1.weekSettings.seasonType, seasonType)),
    });
    if (setting?.lockTime)
        return setting.lockTime;
    // Derive Wednesday 9PM Pacific from the earliest game of the week (same season type only —
    // preseason and regular season both use week numbers 1-4, so this must not cross-match).
    const firstGame = await db_1.db.query.games.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.games.week, week), (0, drizzle_orm_1.eq)(schema_1.games.season, season), (0, drizzle_orm_1.eq)(schema_1.games.sport, 'nfl'), (0, drizzle_orm_1.eq)(schema_1.games.seasonType, seasonType)),
        orderBy: [(0, drizzle_orm_1.asc)(schema_1.games.gameTime)],
    });
    if (!firstGame?.gameTime)
        return null;
    // Anchor on the game's Pacific calendar date (noon UTC avoids any DST-boundary day rollover),
    // then walk back to the most recent Wednesday on/before that date.
    const gameDate = new Date(firstGame.gameTime);
    const { year, month, day } = getPacificDateParts(gameDate);
    const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const weekday = anchor.getUTCDay(); // 0=Sun ... 3=Wed ... 6=Sat, matches Pacific weekday since Y/M/D came from Pacific parts
    const daysToWed = (weekday - 3 + 7) % 7;
    const wedAnchor = new Date(anchor.getTime() - daysToWed * 86400000);
    return pacificWallTimeToUtc(wedAnchor.getUTCFullYear(), wedAnchor.getUTCMonth() + 1, wedAnchor.getUTCDate(), 21, 0);
}
async function isWeekLocked(week, season, seasonType = 'regular') {
    const lockTime = await getWeekLockTime(week, season, seasonType);
    if (!lockTime)
        return false;
    return new Date() >= lockTime;
}
//# sourceMappingURL=lockTime.js.map