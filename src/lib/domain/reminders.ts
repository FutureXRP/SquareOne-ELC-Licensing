import { daysBetween, type DateOnly } from "@/lib/dates";
import type { Enums } from "@/lib/database.types";

/**
 * Milestone selection and de-duplication for reminders (BUILD.md section 7). Pure.
 * The cron route feeds it records and stores what it returns; the unique index on
 * reminder_events is the second line of defense against duplicates.
 */

export type Milestone = Enums<"reminder_milestone">;

export type ReminderItem = {
  kind: "requirement" | "credential";
  id: string;
  dueDate: DateOnly;
  ownerId: string | null;
  backupId: string | null;
  /** Major renewals get the 90-day planning notice: regulatory, accreditation or safety-critical. */
  major: boolean;
};

export type PlannedReminder = {
  kind: ReminderItem["kind"];
  itemId: string;
  milestone: Milestone;
  recipientId: string;
  dueDate: DateOnly;
  /** The 60-day notice also opens a preparation task for the owner. */
  createTask: boolean;
};

const LADDER: { milestone: Milestone; days: number }[] = [
  { milestone: "d90", days: 90 },
  { milestone: "d60", days: 60 },
  { milestone: "d30", days: 30 },
  { milestone: "d14", days: 14 },
  { milestone: "d7", days: 7 },
  { milestone: "due", days: 0 },
];

/** The milestone an item is at today: the nearest threshold it has reached, or null if none yet. */
export function currentMilestone(dueDate: DateOnly, today: DateOnly, enabled: readonly Milestone[]): Milestone | null {
  const daysLeft = daysBetween(today, dueDate);
  if (daysLeft < 0) return enabled.includes("overdue") ? "overdue" : null;
  let hit: Milestone | null = null;
  for (const step of LADDER) {
    if (daysLeft <= step.days && enabled.includes(step.milestone)) hit = step.milestone;
  }
  return hit;
}

export const reminderKey = (r: Pick<PlannedReminder, "kind" | "itemId" | "milestone" | "recipientId" | "dueDate">) =>
  `${r.kind}:${r.itemId}:${r.milestone}:${r.recipientId}:${r.dueDate}`;

/**
 * Who gets told what, today. One notice per item, milestone and recipient.
 * - d90: owner, major renewals only.   - d60 / d30 / d14: owner.
 * - d7: owner, backup and directors.   - due / overdue: owner and directors.
 * An item with no owner goes to the directors so it is never silent.
 */
export function planReminders(
  items: readonly ReminderItem[],
  today: DateOnly,
  options: { enabled: readonly Milestone[]; directorIds: readonly string[]; alreadySent: ReadonlySet<string> },
): PlannedReminder[] {
  const planned = new Map<string, PlannedReminder>();
  for (const item of items) {
    const milestone = currentMilestone(item.dueDate, today, options.enabled);
    if (milestone === null) continue;
    if (milestone === "d90" && !item.major) continue;

    const recipients = new Set<string>();
    if (item.ownerId) recipients.add(item.ownerId);
    if (milestone === "d7" && item.backupId) recipients.add(item.backupId);
    if (milestone === "d7" || milestone === "due" || milestone === "overdue" || recipients.size === 0) {
      for (const id of options.directorIds) recipients.add(id);
    }

    for (const recipientId of recipients) {
      const reminder: PlannedReminder = {
        kind: item.kind,
        itemId: item.id,
        milestone,
        recipientId,
        dueDate: item.dueDate,
        createTask: milestone === "d60" && recipientId === item.ownerId,
      };
      const key = reminderKey(reminder);
      if (!options.alreadySent.has(key) && !planned.has(key)) planned.set(key, reminder);
    }
  }
  return [...planned.values()];
}

export const MILESTONE_LABEL: Record<Milestone, string> = {
  d90: "Due in 90 days",
  d60: "Due in 60 days",
  d30: "Due in 30 days",
  d14: "Due in 14 days",
  d7: "Due in 7 days",
  due: "Due today",
  overdue: "Overdue",
  rejected: "Returned for correction",
  critical: "Critical eligibility concern",
};
