// Client-side lock check: Wednesday 9PM PST = Thursday 5AM UTC
// This is a best-effort check; the backend enforces the real lock.
export function isWeekCurrentlyLocked(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 3=Wed, 4=Thu
  const hour = now.getUTCHours();

  // After Thursday 5AM UTC (Wed 9PM PST) through the following Wednesday
  if (day === 4 && hour >= 5) return true;
  if (day === 5 || day === 6 || day === 0 || day === 1 || day === 2) return true;
  // Wednesday before 5AM UTC = still open (picks due that night)
  return false;
}
