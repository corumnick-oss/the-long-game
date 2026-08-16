import axios from 'axios';
import { db } from '../db';
import { pushTokens, users } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
}

type PushTicket = { status: string; id?: string; message?: string; details?: unknown };

export async function sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>): Promise<PushTicket[]> {
  const tokens = await db.query.pushTokens.findMany({
    where: inArray(pushTokens.userId, userIds),
  });

  if (tokens.length === 0) return [];

  const messages: ExpoPushMessage[] = tokens.map(t => ({
    to: t.token,
    title,
    body,
    sound: 'default',
    data,
  }));

  const allTickets: PushTicket[] = [];

  // Expo push API accepts up to 100 messages per request
  const BATCH = 100;
  for (let i = 0; i < messages.length; i += BATCH) {
    try {
      const response = await axios.post(EXPO_PUSH_URL, messages.slice(i, i + BATCH), {
        headers: { 'Content-Type': 'application/json' },
      });
      const tickets: PushTicket[] = response.data?.data ?? [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'error') {
          console.error(`[Push] Ticket error for token ${messages[i + idx]?.to}:`, ticket.message, ticket.details);
        }
      });
      allTickets.push(...tickets);
    } catch (err) {
      console.error('[Push] Batch send failed:', err);
    }
  }

  return allTickets;
}

export async function sendPushToAllUsers(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  const allUsers = await db.query.users.findMany({ where: eq(users.nflAccess, true) });
  const userIds = allUsers.map(u => u.id);
  await sendPushToUsers(userIds, title, body, data);
}

function weekLabel(week: number, seasonType: 'regular' | 'preseason'): string {
  return seasonType === 'preseason' ? `Preseason Week ${week}` : `Week ${week}`;
}

export async function notifyWeekUnlocked(week: number, seasonType: 'regular' | 'preseason' = 'regular'): Promise<void> {
  await sendPushToAllUsers(
    weekLabel(week, seasonType) + " is now open!",
    "Make your picks before Wednesday 11:59PM PST.",
    { type: 'week_unlocked', week, seasonType }
  );
}

export async function notifyDeadlineApproaching(week: number, seasonType: 'regular' | 'preseason' = 'regular'): Promise<void> {
  await sendPushToAllUsers(
    weekLabel(week, seasonType) + " picks lock tonight at 11:59 PM!",
    "Lock in your picks before they close.",
    { type: 'deadline', week, seasonType }
  );
}

export async function notifyPicksLocked(week: number, seasonType: 'regular' | 'preseason' = 'regular'): Promise<void> {
  await sendPushToAllUsers(
    "Picks locked. Good luck!",
    weekLabel(week, seasonType) + " picks are locked. Games start soon.",
    { type: 'picks_locked', week, seasonType }
  );
}

export async function notifyAchievementEarned(userId: string, achievementName: string, week: number): Promise<void> {
  await sendPushToUsers(
    [userId],
    "You earned " + achievementName + "! 🏅",
    "Week " + week + " achievement unlocked.",
    { type: 'achievement', week }
  );
}

export async function notifyDefaultPicksApplied(userId: string, count: number, week: number, seasonType: 'regular' | 'preseason' = 'regular'): Promise<void> {
  await sendPushToUsers(
    [userId],
    "Your picks were filled in",
    `You had ${count} unpicked game${count === 1 ? '' : 's'} for ${weekLabel(week, seasonType)}. We defaulted to the Raiders (or away team).`,
    { type: 'default_picks', week, seasonType }
  );
}

export async function notifyGameFinal(userId: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number, isCorrect: boolean): Promise<void> {
  const result = isCorrect ? 'correct ✓' : 'wrong ✗';
  await sendPushToUsers(
    [userId],
    `Final: ${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}`,
    `Your pick was ${result}.`,
    { type: 'game_final' }
  );
}
