import { addDays, daysBetween, isDateOnly, type DateOnly } from "@/lib/dates";

/**
 * Recurrence rules -> next due date (BUILD.md section 5). Pure, no I/O.
 * The rule itself is data confirmed by a director; nothing here assumes a renewal period.
 * A recurring deadline is never derived from an upload date unless the rule's anchor says so.
 */

export type RecurrenceRule =
  | { type: "interval"; every: number; unit: "day" | "month" | "year"; anchor: "verified_at" | "fixed_date" | "hire_date" }
  | { type: "fixed_months"; months: number[]; day: number }
  | { type: "expiration"; source: string }
  | { type: "event"; trigger: string };

export type DeadlineContext = {
  /** Chicago calendar date of the review decision. */
  verifiedOn: DateOnly;
  /** The due date of the cycle being renewed (anchor "fixed_date"). */
  previousDue: DateOnly | null;
  hireDate: DateOnly | null;
  /** Expiry date printed on the approved document. */
  evidenceExpiry: DateOnly | null;
};

export function parseRecurrenceRule(value: unknown): RecurrenceRule | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  switch (v.type) {
    case "interval":
      if (
        Number.isInteger(v.every) &&
        (v.every as number) > 0 &&
        (v.unit === "day" || v.unit === "month" || v.unit === "year") &&
        (v.anchor === "verified_at" || v.anchor === "fixed_date" || v.anchor === "hire_date")
      ) {
        return { type: "interval", every: v.every as number, unit: v.unit, anchor: v.anchor };
      }
      return null;
    case "fixed_months":
      if (
        Array.isArray(v.months) &&
        v.months.length > 0 &&
        v.months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12) &&
        Number.isInteger(v.day) &&
        (v.day as number) >= 1 &&
        (v.day as number) <= 31
      ) {
        return { type: "fixed_months", months: [...(v.months as number[])].sort((a, b) => a - b), day: v.day as number };
      }
      return null;
    case "expiration":
      return { type: "expiration", source: typeof v.source === "string" ? v.source : "evidence.expiry_date" };
    case "event":
      return typeof v.trigger === "string" ? { type: "event", trigger: v.trigger } : null;
    default:
      return null;
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function ymd(year: number, month: number, day: number): DateOnly {
  const d = Math.min(day, daysInMonth(year, month));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Add calendar months, clamping to the end of a shorter month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: DateOnly, months: number): DateOnly {
  if (!isDateOnly(date)) throw new Error(`Not a calendar date: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  return ymd(Math.floor(total / 12), (total % 12) + 1, d);
}

function step(date: DateOnly, every: number, unit: "day" | "month" | "year"): DateOnly {
  if (unit === "day") return addDays(date, every);
  return addMonths(date, unit === "year" ? every * 12 : every);
}

/**
 * The next due date after a verification, or null when the rule does not produce one
 * (event-triggered rules, or a rule whose anchor date is not on record).
 */
export function nextDueDate(rule: RecurrenceRule | null, ctx: DeadlineContext): DateOnly | null {
  if (rule === null) return null;
  switch (rule.type) {
    case "interval": {
      if (rule.anchor === "verified_at") return step(ctx.verifiedOn, rule.every, rule.unit);
      const anchor = rule.anchor === "hire_date" ? ctx.hireDate : ctx.previousDue;
      if (anchor === null) return null;
      // The first step on the anchor's own schedule that falls after the verification date.
      let due = anchor;
      for (let i = 0; daysBetween(ctx.verifiedOn, due) <= 0; i += 1) {
        if (i > 5000) return null;
        due = step(due, rule.every, rule.unit);
      }
      return due;
    }
    case "fixed_months": {
      const [y] = ctx.verifiedOn.split("-").map(Number);
      for (const year of [y, y + 1]) {
        for (const month of rule.months) {
          const candidate = ymd(year, month, rule.day);
          if (daysBetween(ctx.verifiedOn, candidate) > 0) return candidate;
        }
      }
      return null;
    }
    case "expiration":
      return ctx.evidenceExpiry;
    case "event":
      return null;
  }
}

export function describeRule(rule: RecurrenceRule | null): string {
  if (rule === null) return "No recurrence rule";
  switch (rule.type) {
    case "interval":
      return `Every ${rule.every} ${rule.unit}${rule.every === 1 ? "" : "s"}, counted from ${rule.anchor.replace("_", " ")}`;
    case "fixed_months":
      return `On day ${rule.day} of month${rule.months.length === 1 ? "" : "s"} ${rule.months.join(", ")}`;
    case "expiration":
      return "When the approved document expires";
    case "event":
      return `When this happens: ${rule.trigger.replace("_", " ")}`;
  }
}
