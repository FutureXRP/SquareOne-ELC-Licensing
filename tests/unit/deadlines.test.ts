import { describe, expect, it } from "vitest";
import { addMonths, describeRule, nextDueDate, parseRecurrenceRule, type DeadlineContext } from "@/lib/domain/deadlines";

const ctx: DeadlineContext = { verifiedOn: "2026-11-24", previousDue: null, hireDate: null, evidenceExpiry: null };

describe("addMonths", () => {
  it("clamps to the end of shorter months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
  });
});

describe("parseRecurrenceRule", () => {
  it("accepts the four shapes and rejects incomplete ones", () => {
    expect(parseRecurrenceRule({ type: "interval", every: 12, unit: "month", anchor: "verified_at" })).not.toBeNull();
    expect(parseRecurrenceRule({ type: "fixed_months", months: [10, 1, 4, 7], day: 15 })).toEqual({ type: "fixed_months", months: [1, 4, 7, 10], day: 15 });
    expect(parseRecurrenceRule({ type: "expiration", source: "credential.expiration_date" })).not.toBeNull();
    expect(parseRecurrenceRule({ type: "event", trigger: "new_hire" })).not.toBeNull();
    expect(parseRecurrenceRule({ type: "interval", every: 0, unit: "month", anchor: "verified_at" })).toBeNull();
    expect(parseRecurrenceRule({ type: "interval", every: 12, unit: "week", anchor: "verified_at" })).toBeNull();
    expect(parseRecurrenceRule({ type: "interval", every: 12, unit: "month", anchor: "upload_date" })).toBeNull();
    expect(parseRecurrenceRule({ type: "fixed_months", months: [13], day: 1 })).toBeNull();
    expect(parseRecurrenceRule(null)).toBeNull();
    expect(parseRecurrenceRule("yearly")).toBeNull();
  });
});

describe("nextDueDate", () => {
  it("returns no date when there is no rule: nothing is assumed", () => {
    expect(nextDueDate(null, ctx)).toBeNull();
    expect(nextDueDate({ type: "event", trigger: "inspection" }, ctx)).toBeNull();
  });

  it("counts an interval from the verification date", () => {
    expect(nextDueDate({ type: "interval", every: 12, unit: "month", anchor: "verified_at" }, ctx)).toBe("2027-11-24");
    expect(nextDueDate({ type: "interval", every: 90, unit: "day", anchor: "verified_at" }, ctx)).toBe("2027-02-22");
    expect(nextDueDate({ type: "interval", every: 2, unit: "year", anchor: "verified_at" }, ctx)).toBe("2028-11-24");
  });

  it("keeps a fixed schedule on its own dates, however late the renewal was approved", () => {
    const rule = { type: "interval", every: 12, unit: "month", anchor: "fixed_date" } as const;
    expect(nextDueDate(rule, { ...ctx, previousDue: "2026-12-01" })).toBe("2026-12-01");
    expect(nextDueDate(rule, { ...ctx, previousDue: "2026-11-01" })).toBe("2027-11-01");
    expect(nextDueDate(rule, { ...ctx, previousDue: "2024-06-30" })).toBe("2027-06-30");
    expect(nextDueDate(rule, { ...ctx, previousDue: null })).toBeNull();
  });

  it("uses the hire-date anniversary", () => {
    const rule = { type: "interval", every: 12, unit: "month", anchor: "hire_date" } as const;
    expect(nextDueDate(rule, { ...ctx, hireDate: "2024-02-29" })).toBe("2027-02-28");
    expect(nextDueDate(rule, { ...ctx, hireDate: "2026-11-24" })).toBe("2027-11-24");
    expect(nextDueDate(rule, { ...ctx, hireDate: null })).toBeNull();
  });

  it("finds the next fixed month, rolling into the next year", () => {
    const rule = { type: "fixed_months", months: [1, 4, 7, 10], day: 15 } as const;
    expect(nextDueDate({ ...rule, months: [...rule.months] }, ctx)).toBe("2027-01-15");
    expect(nextDueDate({ ...rule, months: [...rule.months] }, { ...ctx, verifiedOn: "2026-07-14" })).toBe("2026-07-15");
    expect(nextDueDate({ ...rule, months: [...rule.months] }, { ...ctx, verifiedOn: "2026-07-15" })).toBe("2026-10-15");
    expect(nextDueDate({ type: "fixed_months", months: [2], day: 31 }, { ...ctx, verifiedOn: "2027-01-01" })).toBe("2027-02-28");
  });

  it("follows the document's own expiry and never the upload date", () => {
    const rule = { type: "expiration", source: "credential.expiration_date" } as const;
    expect(nextDueDate(rule, { ...ctx, evidenceExpiry: "2028-03-31" })).toBe("2028-03-31");
    expect(nextDueDate(rule, ctx)).toBeNull();
  });

  it("describes rules in plain words", () => {
    expect(describeRule(null)).toBe("No recurrence rule");
    expect(describeRule({ type: "interval", every: 1, unit: "year", anchor: "verified_at" })).toBe("Every 1 year, counted from verified at");
  });
});
