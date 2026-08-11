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
exports.notifyAchievementEarned = notifyAchievementEarned;
exports.notifyDefaultPicksApplied = notifyDefaultPicksApplied;
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
        return [];
    const messages = tokens.map(t => ({
        to: t.token,
        title,
        body,
        sound: 'default',
        data,
    }));
    const allTickets = [];
    // Expo push API accepts up to 100 messages per request
    const BATCH = 100;
    for (let i = 0; i < messages.length; i += BATCH) {
        try {
            const response = await axios_1.default.post(EXPO_PUSH_URL, messages.slice(i, i + BATCH), {
                headers: { 'Content-Type': 'application/json' },
            });
            const tickets = response.data?.data ?? [];
            tickets.forEach((ticket, idx) => {
                if (ticket.status === 'error') {
                    console.error(`[Push] Ticket error for token ${messages[i + idx]?.to}:`, ticket.message, ticket.details);
                }
            });
            allTickets.push(...tickets);
        }
        catch (err) {
            console.error('[Push] Batch send failed:', err);
        }
    }
    return allTickets;
}
async function sendPushToAllUsers(title, body, data) {
    const allUsers = await db_1.db.query.users.findMany({ where: (0, drizzle_orm_1.eq)(schema_1.users.nflAccess, true) });
    const userIds = allUsers.map(u => u.id);
    await sendPushToUsers(userIds, title, body, data);
}
function weekLabel(week, seasonType) {
    return seasonType === 'preseason' ? `Preseason Week ${week}` : `Week ${week}`;
}
async function notifyWeekUnlocked(week, seasonType = 'regular') {
    await sendPushToAllUsers(weekLabel(week, seasonType) + " is now open!", "Make your picks before Wednesday 9PM PST.", { type: 'week_unlocked', week, seasonType });
}
async function notifyDeadlineApproaching(week, seasonType = 'regular') {
    await sendPushToAllUsers("1 hour left for " + weekLabel(week, seasonType) + " picks!", "Lock in your picks before they close.", { type: 'deadline', week, seasonType });
}
async function notifyPicksLocked(week, seasonType = 'regular') {
    await sendPushToAllUsers("Picks locked. Good luck!", weekLabel(week, seasonType) + " picks are locked. Games start soon.", { type: 'picks_locked', week, seasonType });
}
async function notifyAchievementEarned(userId, achievementName, week) {
    await sendPushToUsers([userId], "You earned " + achievementName + "! 🏅", "Week " + week + " achievement unlocked.", { type: 'achievement', week });
}
async function notifyDefaultPicksApplied(userId, count, week, seasonType = 'regular') {
    await sendPushToUsers([userId], "Your picks were filled in", `You had ${count} unpicked game${count === 1 ? '' : 's'} for ${weekLabel(week, seasonType)}. We defaulted to the Raiders (or away team).`, { type: 'default_picks', week, seasonType });
}
async function notifyGameFinal(userId, homeTeam, awayTeam, homeScore, awayScore, isCorrect) {
    const result = isCorrect ? 'correct ✓' : 'wrong ✗';
    await sendPushToUsers([userId], `Final: ${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}`, `Your pick was ${result}.`, { type: 'game_final' });
}
//# sourceMappingURL=notificationService.js.map