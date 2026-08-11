import { db } from '../db';
import { appSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { isWeekLocked } from './lockTime';

export function getCurrentNFLSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  // Flip to new season in March — after the Super Bowl, before preseason
  return month >= 3 ? year : year - 1;
}

async function firstGameTime(season: number, seasonType: 'preseason' | 'regular'): Promise<Date | null> {
  const { games } = await import('../db/schema');
  const { and, eq: eqOp, asc } = await import('drizzle-orm');
  const g = await db.query.games.findFirst({
    where: and(eqOp(games.season, season), eqOp(games.seasonType, seasonType), eqOp(games.sport, 'nfl')),
    orderBy: [asc(games.gameTime)],
  });
  return g?.gameTime ?? null;
}

// The current week for a season type is the first one whose picks aren't locked yet (still
// open, or about to open) -- naturally advances 1, 2, 3... as each week's Wednesday 9PM lock
// passes. If every known week is already locked, stay on the last one rather than erroring.
async function firstUnlockedOrLastWeek(season: number, seasonType: 'preseason' | 'regular'): Promise<number | null> {
  const { games } = await import('../db/schema');
  const { and, eq: eqOp } = await import('drizzle-orm');
  const rows = await db.query.games.findMany({
    where: and(eqOp(games.season, season), eqOp(games.seasonType, seasonType), eqOp(games.sport, 'nfl')),
    columns: { week: true },
  });
  if (rows.length === 0) return null;
  const weeks = [...new Set(rows.map(r => r.week))].sort((a, b) => a - b);

  for (const w of weeks) {
    if (!(await isWeekLocked(w, season, seasonType))) return w;
  }
  return weeks[weeks.length - 1]!;
}

// Data-driven, not calendar-guessed: preseason week numbering doesn't line up with a fixed
// "first Thursday of August" rule (e.g. 2026's preseason "week 1" was a lone standalone Hall
// of Fame Game a full week before the real 16-game slate) -- so this reads whatever's actually
// synced into the DB instead of assuming a schedule shape.
export async function getCurrentWeekAndType(): Promise<{ week: number; seasonType: 'preseason' | 'regular' }> {
  // Manual admin override (Admin -> app settings) always wins.
  const override = await db.query.appSettings.findFirst({ where: eq(appSettings.key, 'currentWeek') });
  if (override) return { week: parseInt(override.value, 10), seasonType: 'regular' };

  const season = getCurrentNFLSeason();
  const now = new Date();

  const regularStart = await firstGameTime(season, 'regular');
  const regularHasBegun = !!regularStart && regularStart.getTime() <= now.getTime();
  const seasonType: 'preseason' | 'regular' = regularHasBegun ? 'regular' : 'preseason';

  const week = (await firstUnlockedOrLastWeek(season, seasonType)) ?? 1;
  return { week, seasonType };
}

// Backward-compatible wrapper for callers that only need the number.
export async function getCurrentNFLWeek(): Promise<number> {
  return (await getCurrentWeekAndType()).week;
}

export async function isPreseasonMode(): Promise<boolean> {
  const setting = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, 'preseasonMode'),
  });
  return setting?.value === 'true';
}
