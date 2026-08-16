import { db } from '../db';
import { appSettings, unlockedWeeks } from '../db/schema';
import { eq, and } from 'drizzle-orm';
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
// open, or about to open) -- naturally advances 1, 2, 3... as each week's Wednesday 11:59PM lock
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

// The week the scheduler's Tuesday 6AM job has most recently unlocked for a season type --
// this is the single source of truth for "current week" below. Using it (instead of raw
// lock-time math against whatever weeks' games happen to already be synced) is what keeps
// the current week from jumping to next week the instant the current one's Wednesday 11:59PM
// lock passes -- since the full season schedule is pre-synced ahead of time, next week's
// games already exist with a computable (future) lock time well before Tuesday actually
// opens it, and lock-time math alone can't tell "not locked yet" apart from "not open yet".
async function maxUnlockedWeek(season: number, seasonType: 'preseason' | 'regular'): Promise<number | null> {
  const rows = await db.query.unlockedWeeks.findMany({
    where: and(eq(unlockedWeeks.season, season), eq(unlockedWeeks.seasonType, seasonType)),
    columns: { week: true },
  });
  if (rows.length === 0) return null;
  return Math.max(...rows.map(r => r.week));
}

// Next week for the Tuesday 6AM job to sync/unlock: the earliest week (by number) that has
// games synced but isn't in unlocked_weeks yet. Falls back to staying on the last known week
// if every synced week is already unlocked (re-sync is harmless).
async function nextWeekToUnlock(season: number, seasonType: 'preseason' | 'regular'): Promise<number | null> {
  const { games } = await import('../db/schema');
  const { eq: eqOp } = await import('drizzle-orm');
  const rows = await db.query.games.findMany({
    where: and(eqOp(games.season, season), eqOp(games.seasonType, seasonType), eqOp(games.sport, 'nfl')),
    columns: { week: true },
  });
  if (rows.length === 0) return null;
  const weeks = [...new Set(rows.map(r => r.week))].sort((a, b) => a - b);

  const unlockedRows = await db.query.unlockedWeeks.findMany({
    where: and(eq(unlockedWeeks.season, season), eq(unlockedWeeks.seasonType, seasonType)),
    columns: { week: true },
  });
  const unlockedSet = new Set(unlockedRows.map(r => r.week));

  for (const w of weeks) if (!unlockedSet.has(w)) return w;
  return weeks[weeks.length - 1]!;
}

function determineSeasonType(season: number, now: Date): Promise<'preseason' | 'regular'> {
  return firstGameTime(season, 'regular').then(regularStart => {
    const regularHasBegun = !!regularStart && regularStart.getTime() <= now.getTime();
    return regularHasBegun ? 'regular' : 'preseason';
  });
}

// Data-driven, not calendar-guessed: preseason week numbering doesn't line up with a fixed
// "first Thursday of August" rule (e.g. 2026's preseason "week 1" was a lone standalone Hall
// of Fame Game a full week before the real 16-game slate) -- so this reads whatever's actually
// synced into the DB instead of assuming a schedule shape.
//
// "Current week" only advances when the scheduler's Tuesday 6AM job formally unlocks the next
// one (see maxUnlockedWeek above) -- never merely because the previous week's Wednesday 11:59PM
// lock passed.
export async function getCurrentWeekAndType(): Promise<{ week: number; seasonType: 'preseason' | 'regular' }> {
  // Manual admin override (Admin -> app settings) always wins.
  const override = await db.query.appSettings.findFirst({ where: eq(appSettings.key, 'currentWeek') });
  if (override) return { week: parseInt(override.value, 10), seasonType: 'regular' };

  const season = getCurrentNFLSeason();
  const seasonType = await determineSeasonType(season, new Date());

  const week = (await maxUnlockedWeek(season, seasonType)) ?? (await firstUnlockedOrLastWeek(season, seasonType)) ?? 1;
  return { week, seasonType };
}

// Used only by the Tuesday 6AM scheduler job to determine which week to sync + unlock next --
// distinct from getCurrentWeekAndType() above, which reports whatever week is already open.
export async function getNextWeekToUnlock(): Promise<{ week: number; seasonType: 'preseason' | 'regular' }> {
  const season = getCurrentNFLSeason();
  const seasonType = await determineSeasonType(season, new Date());
  const week = (await nextWeekToUnlock(season, seasonType)) ?? 1;
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
