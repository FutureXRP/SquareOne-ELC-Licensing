import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { ALL_MILESTONES, currentMilestone, planReminders, reminderKey, type Milestone, type ReminderItem } from "@/lib/domain/reminders";

const TODAY = "2026-11-24";
const ALL: Milestone[] = [...ALL_MILESTONES];
const item = (daysLeft: number, extra: Partial<ReminderItem> = {}): ReminderItem => ({
  kind: "credential",
  id: "cred-1",
  dueDate: addDays(TODAY, daysLeft),
  ownerId: "owner",
  backupId: "backup",
  critical: false,
  ...extra,
});
const opts = (sent: string[] = []) => ({ enabled: ALL, directorIds: ["director"], alreadySent: new Set(sent) });
const who = (items: ReminderItem[], today = TODAY) => planReminders(items, today, opts()).map((x) => x.recipientId).sort();

describe("currentMilestone", () => {
  it("picks the nearest standard threshold reached", () => {
    expect(currentMilestone(addDays(TODAY, 120), TODAY, ALL)).toBeNull();
    expect(currentMilestone(addDays(TODAY, 90), TODAY, ALL)).toBe("d90");
    expect(currentMilestone(addDays(TODAY, 61), TODAY, ALL)).toBe("d90");
    expect(currentMilestone(addDays(TODAY, 30), TODAY, ALL)).toBe("d30");
    expect(currentMilestone(addDays(TODAY, 8), TODAY, ALL)).toBe("d14");
    expect(currentMilestone(addDays(TODAY, 7), TODAY, ALL)).toBe("d7");
    expect(currentMilestone(addDays(TODAY, 1), TODAY, ALL)).toBe("d7");
    expect(currentMilestone(TODAY, TODAY, ALL)).toBe("due");
    expect(currentMilestone(addDays(TODAY, -1), TODAY, ALL)).toBe("overdue");
  });

  it("adds 120 days and 1 day for critical items only", () => {
    expect(currentMilestone(addDays(TODAY, 120), TODAY, ALL, true)).toBe("d120");
    expect(currentMilestone(addDays(TODAY, 91), TODAY, ALL, true)).toBe("d120");
    expect(currentMilestone(addDays(TODAY, 90), TODAY, ALL, true)).toBe("d90");
    expect(currentMilestone(addDays(TODAY, 1), TODAY, ALL, true)).toBe("d1");
    expect(currentMilestone(addDays(TODAY, 121), TODAY, ALL, true)).toBeNull();
  });

  it("respects the milestones the director has enabled", () => {
    expect(currentMilestone(addDays(TODAY, 80), TODAY, ["d30", "due"])).toBeNull();
    expect(currentMilestone(addDays(TODAY, 10), TODAY, ["d30", "due"])).toBe("d30");
    expect(currentMilestone(addDays(TODAY, -3), TODAY, ["d30", "due"])).toBeNull();
  });
});

describe("planReminders", () => {
  it("a credential due in 30 days produces exactly one notice per recipient, once", () => {
    const first = planReminders([item(30)], TODAY, opts());
    expect(first.map((r) => `${r.milestone}:${r.recipientId}`).sort()).toEqual(["d30:director", "d30:owner"]);
    // The next day's run sees them as already sent and plans nothing more.
    expect(planReminders([item(30)], addDays(TODAY, 1), opts(first.map(reminderKey)))).toHaveLength(0);
  });

  it("never plans the same notice twice in one run", () => {
    expect(planReminders([item(60), item(60)], TODAY, opts())).toHaveLength(1);
  });

  it("notifies the assigned person first: only the owner before 30 days", () => {
    expect(who([item(90)])).toEqual(["owner"]);
    expect(who([item(60)])).toEqual(["owner"]);
    expect(who([item(120, { critical: true })])).toEqual(["owner"]);
    expect(planReminders([item(120)], TODAY, opts())).toHaveLength(0); // 120 days is for critical items
  });

  it("adds the director at 30 days and the backup at 14 days", () => {
    expect(who([item(30)])).toEqual(["director", "owner"]);
    expect(who([item(14)])).toEqual(["backup", "director", "owner"]);
    expect(who([item(7)])).toEqual(["backup", "director", "owner"]);
    expect(who([item(0)])).toEqual(["backup", "director", "owner"]);
  });

  it("opens a preparation task at 60 days, for the owner", () => {
    const [r] = planReminders([item(60)], TODAY, opts());
    expect(r).toMatchObject({ milestone: "d60", recipientId: "owner", createTask: true });
  });

  it("sends one overdue notice for a standard item (the weekly digest carries it after that)", () => {
    const day1 = planReminders([item(-1)], TODAY, opts());
    expect(day1.every((x) => x.milestone === "overdue" && x.noticeDate === null)).toBe(true);
    expect(day1).toHaveLength(3);
    expect(planReminders([item(-1)], addDays(TODAY, 1), opts(day1.map(reminderKey)))).toHaveLength(0);
  });

  it("sends an overdue notice every day for a critical item until it is resolved", () => {
    const critical = item(-1, { critical: true });
    const day1 = planReminders([critical], TODAY, opts());
    expect(day1.every((x) => x.noticeDate === TODAY)).toBe(true);
    // Same day again: nothing new. Next day: a fresh set.
    expect(planReminders([critical], TODAY, opts(day1.map(reminderKey)))).toHaveLength(0);
    const day2 = planReminders([critical], addDays(TODAY, 1), opts(day1.map(reminderKey)));
    expect(day2).toHaveLength(3);
    expect(day2.every((x) => x.noticeDate === addDays(TODAY, 1))).toBe(true);
  });

  it("gives a critical item a notice the day before it is due", () => {
    expect(planReminders([item(1, { critical: true })], TODAY, opts()).every((x) => x.milestone === "d1")).toBe(true);
    expect(planReminders([item(1)], TODAY, opts()).every((x) => x.milestone === "d7")).toBe(true);
  });

  it("routes an item with no owner to the director so it is never silent", () => {
    const r = planReminders([item(60, { ownerId: null })], TODAY, opts());
    expect(r).toEqual([expect.objectContaining({ recipientId: "director", milestone: "d60" })]);
  });
});
