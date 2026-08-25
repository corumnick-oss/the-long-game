// Manual UTC -> Pacific conversion for on-device display. Deliberately NOT using
// Intl.DateTimeFormat's `timeZone` option -- Hermes on-device doesn't reliably honor it (it
// silently falls back to UTC instead of throwing or erroring, so a converted time can render
// 7-8 hours off with no indication anything went wrong). This computes the Pacific offset
// directly from the standard US DST rule (2nd Sunday of March 2AM -> 1st Sunday of November
// 2AM) instead of depending on the device having full ICU timezone data.

function nthSundayOfMonthUTC(year: number, month0: number, n: number): Date {
  const first = new Date(Date.UTC(year, month0, 1));
  const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
  return new Date(Date.UTC(year, month0, firstSunday + (n - 1) * 7));
}

function isPacificDST(utcDate: Date): boolean {
  const year = utcDate.getUTCFullYear();
  // 2nd Sunday of March, 10:00 UTC == 2:00 AM PST (UTC-8) -- the instant DST begins.
  const dstStart = new Date(nthSundayOfMonthUTC(year, 2, 2).getTime() + 10 * 60 * 60 * 1000);
  // 1st Sunday of November, 09:00 UTC == 2:00 AM PDT (UTC-7) -- the instant DST ends.
  const dstEnd = new Date(nthSundayOfMonthUTC(year, 10, 1).getTime() + 9 * 60 * 60 * 1000);
  return utcDate >= dstStart && utcDate < dstEnd;
}

type PacificParts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number };

function toPacificParts(d: Date): PacificParts {
  const offsetHours = isPacificDST(d) ? 7 : 8;
  const shifted = new Date(d.getTime() - offsetHours * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatHourMinute(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h12}:${pad2(minute)} ${ampm}`;
}

// "Aug 19, 11:59 PM" / with weekday: "Wed, Aug 19, 11:59 PM" or "Wednesday, Aug 19, 11:59 PM"
export function formatPacific(d: Date, opts: { weekday?: 'short' | 'long' } = {}): string {
  const p = toPacificParts(d);
  const time = formatHourMinute(p.hour, p.minute);
  const datePart = `${MONTHS_SHORT[p.month]} ${p.day}`;
  if (opts.weekday) {
    const wd = opts.weekday === 'long' ? WEEKDAYS_LONG[p.weekday] : WEEKDAYS_SHORT[p.weekday];
    return `${wd}, ${datePart}, ${time}`;
  }
  return `${datePart}, ${time}`;
}

// "Aug 19" -- date only, no time.
export function formatPacificDateOnly(d: Date): string {
  const p = toPacificParts(d);
  return `${MONTHS_SHORT[p.month]} ${p.day}`;
}
