// All dates are handled as local calendar keys ("YYYY-MM-DD") so that
// time zones never shift a habit onto the wrong day.

export type DateKey = string; // YYYY-MM-DD
export type MonthKey = string; // YYYY-MM

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

export function monthKeyOf(key: DateKey): MonthKey {
  return key.slice(0, 7);
}

export function monthKey(year: number, month0: number): MonthKey {
  return `${year}-${pad(month0 + 1)}`;
}

export function parseMonthKey(mk: MonthKey): { year: number; month0: number } {
  const [y, m] = mk.split('-').map(Number);
  return { year: y, month0: m - 1 };
}

export function addMonths(mk: MonthKey, n: number): MonthKey {
  const { year, month0 } = parseMonthKey(mk);
  const d = new Date(year, month0 + n, 1);
  return monthKey(d.getFullYear(), d.getMonth());
}

export function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

export function monthDays(mk: MonthKey): DateKey[] {
  const { year, month0 } = parseMonthKey(mk);
  const n = daysInMonth(year, month0);
  return Array.from({ length: n }, (_, i) => `${mk}-${pad(i + 1)}`);
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function diffDays(a: DateKey, b: DateKey): number {
  // whole days from b to a; uses UTC to avoid DST drift
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

export function rangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  const n = diffDays(to, from);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

export function weekday(key: DateKey): number {
  return parseKey(key).getDay();
}

export function startOfWeek(key: DateKey, weekStart: number): DateKey {
  const wd = weekday(key);
  const delta = (wd - weekStart + 7) % 7;
  return addDays(key, -delta);
}

export function endOfWeek(key: DateKey, weekStart: number): DateKey {
  return addDays(startOfWeek(key, weekStart), 6);
}

export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key: DateKey): DateKey {
  const { year, month0 } = parseMonthKey(key.slice(0, 7));
  return `${key.slice(0, 7)}-${pad(daysInMonth(year, month0))}`;
}

export function startOfQuarter(key: DateKey): DateKey {
  const d = parseKey(key);
  return toKey(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1));
}

export function endOfQuarter(key: DateKey): DateKey {
  const d = parseKey(key);
  return toKey(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0));
}

export function startOfYear(key: DateKey): DateKey {
  return `${key.slice(0, 4)}-01-01`;
}

export function endOfYear(key: DateKey): DateKey {
  return `${key.slice(0, 4)}-12-31`;
}

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_MIN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtMonth(mk: MonthKey, short = false): string {
  const { year, month0 } = parseMonthKey(mk);
  return `${short ? MONTHS[month0].slice(0, 3) : MONTHS[month0]} ${year}`;
}

export function fmtDate(key: DateKey, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return parseKey(key).toLocaleDateString(undefined, opts);
}

export function fmtLong(key: DateKey): string {
  return fmtDate(key, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function minKey(a: DateKey, b: DateKey) { return a < b ? a : b; }
export function maxKey(a: DateKey, b: DateKey) { return a > b ? a : b; }

export function isValidKey(s: unknown): s is DateKey {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toKey(parseKey(s)) === s;
}
