import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { currentMilestone, planReminders, reminderKey, type Milestone, type ReminderItem } from "@/lib/domain/reminders";

const TODAY = "2026-11-24";
const ALL: Milestone[] = ["d90", "d60", "d30", "d14", "d7", "due", "overdue"];
const item = (daysLeft: number, extra: Partial<ReminderItem> = {}): ReminderItem => ({
  kind: "credential",
  id: "cred-1",
  dueDate: addDays(TODAY, daysLeft),
  ownerId: "owner",
  backupId: "backup",
  major: true,
  ...extra,
});
const opts = (sent: string[] = []) => ({ enabled: ALL, directorIds: ["director"], alreadySent: new Set(sent) });

describe("currentMilestone", () => {
  it("picks the nearest threshold reached", () => {
    expect(currentMilestone(addDays(TODAY, 120), TODAY, ALL)).toBeNull();
    expect(currentMilestone(addDays(TODAY, 90), TODAY, ALL)).toBe("d90");
    expect(currentMilestone(addDays(TODAY, 61), TODAY, ALL)).toBe("d90");
    expect(currentMilestone(addDays(TODAY, 30), TODAY, ALL)).toBe("d30");
    expect(currentMilestone(addDays(TODAY, 8), TODAY, ALL)).toBe("d14");
    expect(currentMilestone(addDays(TODAY, 7), TODAY, ALL)).toBe("d7");
    expect(currentMilestone(TODAY, TODAY, ALL)).toBe("due");
    expect(currentMilestone(addDays(TODAY, -1), TODAY, ALL)).toBe("overdue");
  });

  it("respects the milestones the director has enabled", () => {
    expect(currentMilestone(addDays(TODAY, 80), TODAY, ["d30", "due"])).toBeNull();
    expect(currentMilestone(addDays(TODAY, 10), TODAY, ["d30", "due"])).toBe("d30");
    expect(currentMilestone(addDays(TODAY, -3), TODAY, ["d30", "due"])).toBeNull();
  });
});

describe("planReminders", () => {
  it("a credential due in 30 days produces exactly one notice, to its owner", () => {
    const first = planReminders([item(30)], TODAY, opts());
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ milestone: "d30", recipientId: "owner", createTask: false });
    // The next day's run sees it as already sent and plans nothing more.
    const again = planReminders([item(30)], addDays(TODAY, 1), opts(first.map(reminderKey)));
    expect(again).toHaveLength(0);
  });

  it("never plans the same notice twice in one run", () => {
    expect(planReminders([item(30), item(30)], TODAY, opts())).toHaveLength(1);
  });

  it("sends the 90-day planning notice for major renewals only", () => {
    expect(planReminders([item(90)], TODAY, opts())).toHaveLength(1);
    expect(planReminders([item(90, { major: false })], TODAY, opts())).toHaveLength(0);
  });

  it("opens a preparation task at 60 days", () => {
    const [r] = planReminders([item(60)], TODAY, opts());
    expect(r).toMatchObject({ milestone: "d60", recipientId: "owner", createTask: true });
  });

  it("escalates at 7 days to the owner, backup and director", () => {
    const r = planReminders([item(7)], TODAY, opts());
    expect(r.map((x) => x.recipientId).sort()).toEqual(["backup", "director", "owner"]);
  });

  it("tells the owner and director on the due date and when overdue", () => {
    expect(planReminders([item(0)], TODAY, opts()).map((x) => x.recipientId).sort()).toEqual(["director", "owner"]);
    const overdue = planReminders([item(-5)], TODAY, opts());
    expect(overdue.every((x) => x.milestone === "overdue")).toBe(true);
    expect(overdue).toHaveLength(2);
  });

  it("routes an item with no owner to the director so it is never silent", () => {
    const r = planReminders([item(30, { ownerId: null })], TODAY, opts());
    expect(r).toEqual([expect.objectContaining({ recipientId: "director", milestone: "d30" })]);
  });
});
