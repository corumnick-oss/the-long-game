"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeekLockTime = getWeekLockTime;
exports.isWeekLocked = isWeekLocked;
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
// Wednesday 9PM America/Los_Angeles. With TZ=America/Los_Angeles on Railway,
// node-cron uses local time. This helper checks the DB override first.
async function getWeekLockTime(week, season) {
    const setting = await db_1.db.query.weekSettings.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.weekSettings.week, week), (0, drizzle_orm_1.eq)(schema_1.weekSettings.season, season)),
    });
    if (setting?.lockTime)
        return setting.lockTime;
    // Derive Wednesday 9PM PST from the earliest game of the week
    const firstGame = await db_1.db.query.games.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.games.week, week), (0, drizzle_orm_1.eq)(schema_1.games.season, season), (0, drizzle_orm_1.eq)(schema_1.games.sport, 'nfl')),
        orderBy: [(0, drizzle_orm_1.asc)(schema_1.games.gameTime)],
    });
    if (!firstGame?.gameTime)
        return null;
    // NFL week: games start Thursday; lock is the Wednesday before at 9PM PST (= Thu 05:00 UTC)
    const gameDate = new Date(firstGame.gameTime);
    const lockDate = new Date(gameDate);
    // Go back to the Wednesday before the week's first game
    const dayOfWeek = gameDate.getUTCDay(); // 0=Sun
    const daysToWed = dayOfWeek === 4 ? 1 : dayOfWeek === 0 ? 4 : dayOfWeek === 1 ? 5 : dayOfWeek === 6 ? 3 : dayOfWeek - 3;
    lockDate.setUTCDate(lockDate.getUTCDate() - daysToWed);
    lockDate.setUTCHours(5, 0, 0, 0); // Wednesday 9PM PST = Thursday 05:00 UTC
    return lockDate;
}
async function isWeekLocked(week, season) {
    const lockTime = await getWeekLockTime(week, season);
    if (!lockTime)
        return false;
    return new Date() >= lockTime;
}
//# sourceMappingURL=lockTime.js.map