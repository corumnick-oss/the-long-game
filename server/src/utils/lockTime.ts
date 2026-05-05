import { db } from '../db';
import { weekSettings, games } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';

// Wednesday 9PM America/Los_Angeles. With TZ=America/Los_Angeles on Railway,
// node-cron uses local time. This helper checks the DB override first.
export async function getWeekLockTime(week: number, season: number): Promise<Date | null> {
  const setting = await db.query.weekSettings.findFirst({
    where: and(eq(weekSettings.week, week), eq(weekSettings.season, season)),
  });
  if (setting?.lockTime) return setting.lockTime;

  // Derive Wednesday 9PM PST from the earliest game of the week
  const firstGame = await db.query.games.findFirst({
    where: and(eq(games.week, week), eq(games.season, season), eq(games.sport, 'nfl')),
    orderBy: [asc(games.gameTime)],
  });

  if (!firstGame?.gameTime) return null;

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

export async function isWeekLocked(week: number, season: number): Promise<boolean> {
  const lockTime = await getWeekLockTime(week, season);
  if (!lockTime) return false;
  return new Date() >= lockTime;
}
