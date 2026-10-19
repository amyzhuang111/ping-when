/** Fixed clock for the case study. Monday, 19 October 2026. */
export const AS_OF = new Date(Date.UTC(2026, 9, 19));
/** Sunday ending the case-study week. */
export const WEEK_END = new Date(Date.UTC(2026, 9, 25));

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function parseISODate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new Error(`Expected YYYY-MM-DD, received ${iso}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function toISODate(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addMonths(date: Date, months: number): Date {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)),
  );
}

/** Whole days from `from` to `to`. Positive when `to` is later. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function formatDay(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatShort(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function weekOf(date: Date): Date {
  const day = date.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(date, delta);
}

export function formatWeek(date: Date): string {
  return `week of ${formatShort(weekOf(date))}`;
}

/** Monday–Sunday week containing `asOf`, ending on Sunday. For the case-study clock this is 25 Oct 2026. */
export function weekEnding(asOf: Date): Date {
  return addDays(weekOf(asOf), 6);
}

/** UTC calendar day for an operator session. */
export function todayUTC(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Role start as YYYY-MM or YYYY-MM-DD.
 * A month with no day is the first of that month.
 */
export function parseStartDate(value: string): string | null {
  const trimmed = value.trim();
  const month = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (month) {
    const m = Number(month[2]);
    if (m < 1 || m > 12) return null;
    return `${month[1]}-${month[2]}-01`;
  }
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(trimmed)) return null;
  const parsed = parseISODate(trimmed);
  if (toISODate(parsed) !== trimmed) return null;
  return trimmed;
}

export function monthsInRole(startISO: string, asOf: Date = AS_OF): number {
  const start = parseISODate(startISO);
  let months =
    (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - start.getUTCMonth());
  if (asOf.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() <= bEnd.getTime() && aEnd.getTime() >= bStart.getTime();
}

/** `daysAgo` positive means the event is in the past. */
export function describeDaysAgo(daysAgo: number): string {
  if (daysAgo === 0) return "today";
  const n = Math.abs(daysAgo);
  const unit = n === 1 ? "day" : "days";
  if (daysAgo < 0) return `in ${n} ${unit}`;
  return `${n} ${unit} ago`;
}
