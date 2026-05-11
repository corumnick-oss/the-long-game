"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToUsers = sendPushToUsers;
exports.sendPushToAllUsers = sendPushToAllUsers;
exports.notifyWeekUnlocked = notifyWeekUnlocked;
exports.notifyDeadlineApproaching = notifyDeadlineApproaching;
exports.notifyPicksLocked = notifyPicksLocked;
exports.notifyTrophyEarned = notifyTrophyEarned;
exports.notifyGameFinal = notifyGameFinal;
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
async function sendPushToUsers(userIds, title, body, data) {
    const tokens = await db_1.db.query.pushTokens.findMany({
        where: (0, drizzle_orm_1.inArray)(schema_1.pushTokens.userId, userIds),
    });
    if (tokens.length === 0)
        return;
    const messages = tokens.map(t => ({
        to: t.token,
        title,
        body,
        sound: 'default',
        data,
    }));
    // Expo push API accepts up to 100 messages per request
    const BATCH = 100;
    for (let i = 0; i < messages.length; i += BATCH) {
        try {
            await axios_1.default.post(EXPO_PUSH_URL, messages.slice(i, i + BATCH), {
                headers: { 'Content-Type': 'application/json' },
            });
        }
        catch (err) {
            console.error('[Push] Batch send failed:', err);
        }
    }
}
async function sendPushToAllUsers(title, body, data) {
    const allUsers = await db_1.db.query.users.findMany({ where: (0, drizzle_orm_1.eq)(schema_1.users.nflAccess, true) });
    const userIds = allUsers.map(u => u.id);
    await sendPushToUsers(userIds, title, body, data);
}
async function notifyWeekUnlocked(week) {
    await sendPushToAllUsers("Week " + week + " is now open!", "Make your picks before Wednesday 9PM PST.", { type: 'week_unlocked', week });
}
async function notifyDeadlineApproaching(week) {
    await sendPushToAllUsers("1 hour left for Week " + week + " picks!", "Lock in your picks before they close.", { type: 'deadline', week });
}
async function notifyPicksLocked(week) {
    await sendPushToAllUsers("Picks locked. Good luck!", "Week " + week + " picks are locked. Games start soon.", { type: 'picks_locked', week });
}
async function notifyTrophyEarned(userId, trophyName, week) {
    await sendPushToUsers([userId], "You won " + trophyName + "!", "You earned the " + trophyName + " trophy for Week " + week + ".", { type: 'trophy', week });
}
async function notifyGameFinal(userId, homeTeam, awayTeam, homeScore, awayScore, isCorrect) {
    const result = isCorrect ? 'correct ✓' : 'wrong ✗';
    await sendPushToUsers([userId], `Final: ${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}`, `Your pick was ${result}.`, { type: 'game_final' });
}
//# sourceMappingURL=notificationService.js.map