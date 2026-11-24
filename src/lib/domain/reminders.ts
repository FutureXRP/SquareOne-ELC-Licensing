import { daysBetween, type DateOnly } from "@/lib/dates";
import type { Enums } from "@/lib/database.types";

/**
 * Milestone selection and de-duplication for reminders (BUILD.md section 7, with the
 * schedule the director approved on 2026-11-24). Pure. The cron route feeds it records and
 * stores what it returns; the unique index on reminder_events is the second line of
 * defense against duplicates.
 *
 * Standard items:  90, 60, 30, 14 and 7 days, the due date, then one overdue notice
 *                  (after that the weekly digest carries it).
 * Critical items:  the same, plus 120 days and 1 day, and an overdue notice every day
 *                  until resolved. Critical = licenses, accreditation, safety-critical and
 *                  regulatory requirements, and credential types marked critical.
 * Who:             the assigned person first; the director from 30 days; the backup from 14.
 */

export type Milestone = Enums<"reminder_milestone">;

export type ReminderItem = {
  kind: "requirement" | "credential";
  id: string;
  dueDate: DateOnly;
  ownerId: string | null;
  backupId: string | null;
  critical: boolean;
};

export type PlannedReminder = {
  kind: ReminderItem["kind"];
  itemId: string;
  milestone: Milestone;
  recipientId: string;
  dueDate: DateOnly;
  /** Set only for daily overdue notices on critical items: one per day. */
  noticeDate: DateOnly | null;
  /** The 60-day notice also opens a preparation task for the owner. */
  createTask: boolean;
};

const LADDER: { milestone: Milestone; days: number; criticalOnly?: boolean }[] = [
  { milestone: "d120", days: 120, criticalOnly: true },
  { milestone: "d90", days: 90 },
  { milestone: "d60", days: 60 },
  { milestone: "d30", days: 30 },
  { milestone: "d14", days: 14 },
  { milestone: "d7", days: 7 },
  { milestone: "d1", days: 1, criticalOnly: true },
  { milestone: "due", days: 0 },
];

const DIRECTOR_FROM: readonly Milestone[] = ["d30", "d14", "d7", "d1", "due", "overdue"];
const BACKUP_FROM: readonly Milestone[] = ["d14", "d7", "d1", "due", "overdue"];

/** The milestone an item is at today: the nearest threshold it has reached, or null if none yet. */
export function currentMilestone(dueDate: DateOnly, today: DateOnly, enabled: readonly Milestone[], critical = false): Milestone | null {
  const daysLeft = daysBetween(today, dueDate);
  if (daysLeft < 0) return enabled.includes("overdue") ? "overdue" : null;
  let hit: Milestone | null = null;
  for (const step of LADDER) {
    if (step.criticalOnly && !critical) continue;
    if (daysLeft <= step.days && enabled.includes(step.milestone)) hit = step.milestone;
  }
  return hit;
}

export const reminderKey = (r: Pick<PlannedReminder, "kind" | "itemId" | "milestone" | "recipientId" | "dueDate" | "noticeDate">) =>
  `${r.kind}:${r.itemId}:${r.milestone}:${r.recipientId}:${r.dueDate}:${r.noticeDate ?? ""}`;

/**
 * Who gets told what, today. One notice per item, milestone and recipient (and per day for
 * critical overdue items). An item with no owner goes to the directors so it is never silent.
 */
export function planReminders(
  items: readonly ReminderItem[],
  today: DateOnly,
  options: { enabled: readonly Milestone[]; directorIds: readonly string[]; alreadySent: ReadonlySet<string> },
): PlannedReminder[] {
  const planned = new Map<string, PlannedReminder>();
  for (const item of items) {
    const milestone = currentMilestone(item.dueDate, today, options.enabled, item.critical);
    if (milestone === null) continue;

    const recipients = new Set<string>();
    if (item.ownerId) recipients.add(item.ownerId);
    if (BACKUP_FROM.includes(milestone) && item.backupId) recipients.add(item.backupId);
    if (DIRECTOR_FROM.includes(milestone) || recipients.size === 0) {
      for (const id of options.directorIds) recipients.add(id);
    }

    for (const recipientId of recipients) {
      const reminder: PlannedReminder = {
        kind: item.kind,
        itemId: item.id,
        milestone,
        recipientId,
        dueDate: item.dueDate,
        noticeDate: milestone === "overdue" && item.critical ? today : null,
        createTask: milestone === "d60" && recipientId === item.ownerId,
      };
      const key = reminderKey(reminder);
      if (!options.alreadySent.has(key) && !planned.has(key)) planned.set(key, reminder);
    }
  }
  return [...planned.values()];
}

export const ALL_MILESTONES: readonly Milestone[] = ["d120", "d90", "d60", "d30", "d14", "d7", "d1", "due", "overdue"];

export const MILESTONE_LABEL: Record<Milestone, string> = {
  d120: "Due in 120 days",
  d90: "Due in 90 days",
  d60: "Due in 60 days",
  d30: "Due in 30 days",
  d14: "Due in 14 days",
  d7: "Due in 7 days",
  d1: "Due tomorrow",
  due: "Due today",
  overdue: "Overdue",
  rejected: "Returned for correction",
  critical: "Critical eligibility concern",
};
