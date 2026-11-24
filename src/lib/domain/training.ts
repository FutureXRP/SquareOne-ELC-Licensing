import type { Enums } from "@/lib/database.types";

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
