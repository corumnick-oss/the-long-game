export function getCurrentNFLSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  // Flip to new season on August 1 — preseason starts Aug 7
  return month >= 8 ? year : year - 1;
}

export function getCurrentNFLWeek(): number {
  // NFL regular season starts first Thursday of September
  const season = getCurrentNFLSeason();
  const seasonStart = getNFLSeasonStart(season);
  const now = new Date();

  if (now < seasonStart) return 1;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const week = Math.floor((now.getTime() - seasonStart.getTime()) / msPerWeek) + 1;
  if (week > 18) return 1; // offseason — next season hasn't started yet
  return Math.max(week, 1);
}

function getNFLSeasonStart(season: number): Date {
  // First Thursday of September for the given season year
  const sep1 = new Date(season, 8, 1); // September 1
  const day = sep1.getDay(); // 0=Sun, 4=Thu
  const daysUntilThursday = (4 - day + 7) % 7;
  return new Date(season, 8, 1 + daysUntilThursday);
}
