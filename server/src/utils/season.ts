import { db } from '../db';
import { appSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

export function getCurrentNFLSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  // Flip to new season in March — after the Super Bowl, before preseason
  return month >= 3 ? year : year - 1;
}

export async function getCurrentNFLWeek(): Promise<number> {
  const setting = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, 'currentWeek'),
  });
  if (setting) return parseInt(setting.value, 10);

  // Derive from most recent game data
  const { games } = await import('../db/schema');
  const { desc, and } = await import('drizzle-orm');
  const season = getCurrentNFLSeason();
  const now = new Date();

  const game = await db.query.games.findFirst({
    where: and(
      eq(games.season, season),
      eq(games.sport, 'nfl'),
    ),
    orderBy: [desc(games.week)],
  });

  return game?.week ?? 1;
}

export async function isPreseasonMode(): Promise<boolean> {
  const setting = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, 'preseasonMode'),
  });
  return setting?.value === 'true';
}
