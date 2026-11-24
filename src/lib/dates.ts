import { formatInTimeZone } from "date-fns-tz";

/** All "today" math uses the program's local calendar date, never server UTC (rule 12). */
export const APP_TIMEZONE = "America/Chicago";

/** A calendar date with no time, formatted `yyyy-MM-dd` (matches Postgres `date`). */
export type DateOnly = string;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

function toUtcDays(date: DateOnly): number {
  if (!isDateOnly(date)) throw new Error(`Not a calendar date: ${String(date)}`);
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Today's calendar date in America/Chicago. Pass `now` to keep callers deterministic. */
export function chicagoToday(now: Date = new Date()): DateOnly {
  return formatInTimeZone(now, APP_TIMEZONE, "yyyy-MM-dd");
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DateOnly, to: DateOnly): number {
  return toUtcDays(to) - toUtcDays(from);
}

export function addDays(date: DateOnly, days: number): DateOnly {
  if (!Number.isInteger(days)) throw new Error("days must be an integer");
  return new Date((toUtcDays(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

/** Display a calendar date without shifting it through a time zone. */
export function formatDateOnly(date: DateOnly): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** True when an ISO timestamp is in the past. Kept here so pages stay free of clock reads. */
export function isPast(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}
