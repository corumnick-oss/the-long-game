import { db } from '../db';
import { weekSettings, games } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';

const PACIFIC_TZ = 'America/Los_Angeles';

// Converts a Y/M/D + hour:minute *wall clock time in America/Los_Angeles* into the
// correct UTC instant, correctly accounting for PST/PDT (DST changes twice a season).
function pacificWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(utcGuess).map(p => [p.type, p.value])) as Record<string, string>;
  const hourNum = parts.hour === '24' ? 0 : Number(parts.hour);
  const asIfUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hourNum, Number(parts.minute));
  const diff = utcGuess.getTime() - asIfUtc;
  return new Date(utcGuess.getTime() + diff);
}

// Reads the Y/M/D of a UTC instant as it falls on the Pacific calendar.
function getPacificDateParts(date: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value])) as Record<string, string>;
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

// 11:59PM America/Los_Angeles, the calendar day before the week's earliest game — NOT always
// a Wednesday. A normal week (first game Thursday) locks Wednesday, but a week whose earliest
// game is itself on a Wednesday (e.g. a season-opening Wednesday game) locks Tuesday, and a
// week whose earliest game is Saturday (e.g. a Saturday-only final week) locks Friday. This is
// one general rule, not a per-week special case — do not reintroduce a "walk back to Wednesday"
// shortcut here. DST-aware — do not replace with fixed UTC offset math.
export async function getWeekLockTime(week: number, season: number, seasonType: string = 'regular'): Promise<Date | null> {
  const setting = await db.query.weekSettings.findFirst({
    where: and(eq(weekSettings.week, week), eq(weekSettings.season, season), eq(weekSettings.seasonType, seasonType)),
  });
  if (setting?.lockTime) return setting.lockTime;

  // Same season type only — preseason and regular season both use week numbers 1-4, so this
  // must not cross-match.
  const firstGame = await db.query.games.findFirst({
    where: and(eq(games.week, week), eq(games.season, season), eq(games.sport, 'nfl'), eq(games.seasonType, seasonType)),
    orderBy: [asc(games.gameTime)],
  });

  if (!firstGame?.gameTime) return null;

  // Anchor on the game's Pacific calendar date (noon UTC avoids any DST-boundary day rollover),
  // then step back exactly one day. Date.UTC normalizes month/year rollover automatically, so
  // this is safe even when the first game falls on the 1st of a month.
  const gameDate = new Date(firstGame.gameTime);
  const { year, month, day } = getPacificDateParts(gameDate);
  const gameDayAnchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const lockDayAnchor = new Date(gameDayAnchor.getTime() - 86400000);

  return pacificWallTimeToUtc(lockDayAnchor.getUTCFullYear(), lockDayAnchor.getUTCMonth() + 1, lockDayAnchor.getUTCDate(), 23, 59);
}

export async function isWeekLocked(week: number, season: number, seasonType: string = 'regular'): Promise<boolean> {
  const lockTime = await getWeekLockTime(week, season, seasonType);
  if (!lockTime) return false;
  return new Date() >= lockTime;
}
