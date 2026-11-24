import { addDays, type DateOnly } from "@/lib/dates";
import type { Enums } from "@/lib/database.types";
import { addMonths } from "@/lib/domain/deadlines";

/** Training-hour math. Time is integer minutes everywhere (rule 11). */

export type TrainingRow = { minutes: number; state: Enums<"training_state"> };

export type TrainingSummary = {
  verifiedMinutes: number;
  pendingMinutes: number;
  /** Null when no target is set for the role and period. */
  targetMinutes: number | null;
  remainingMinutes: number | null;
};

export function summarizeTraining(
  rows: readonly TrainingRow[],
  targetMinutes: number | null,
): TrainingSummary {
  let verifiedMinutes = 0;
  let pendingMinutes = 0;
  for (const row of rows) {
    if (!Number.isInteger(row.minutes) || row.minutes < 0) {
      throw new Error(`Training minutes must be a non-negative integer, got ${row.minutes}`);
    }
    if (row.state === "verified") verifiedMinutes += row.minutes;
    else if (row.state === "pending") pendingMinutes += row.minutes;
    // ineligible records count toward nothing
  }
  return {
    verifiedMinutes,
    pendingMinutes,
    targetMinutes,
    // Only verified minutes reduce what remains; pending minutes never do.
    remainingMinutes: targetMinutes === null ? null : Math.max(0, targetMinutes - verifiedMinutes),
  };
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * A person's PDL renewal year: the 12 months ending on their renewal date.
 * Progress is reported against this window, not the calendar year.
 */
export function pdlRenewalYear(renewalDate: DateOnly): { start: DateOnly; end: DateOnly } {
  return { start: addDays(addMonths(renewalDate, -12), 1), end: renewalDate };
}

export type PdlTarget = { level_min: number; level_max: number; target_minutes: number; confirmed: boolean };

/** The renewal-hours target for a PDL level. Only a director-confirmed row counts; otherwise there is no target. */
export function pdlTargetMinutes(level: number | null, targets: readonly PdlTarget[]): number | null {
  if (level === null) return null;
  const match = targets.find((t) => t.confirmed && level >= t.level_min && level <= t.level_max);
  return match ? match.target_minutes : null;
}

export function inWindow(date: DateOnly, window: { start: DateOnly; end: DateOnly }): boolean {
  return date >= window.start && date <= window.end;
}
