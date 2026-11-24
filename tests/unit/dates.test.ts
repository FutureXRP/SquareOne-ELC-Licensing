import { describe, expect, it } from "vitest";
import { addDays, chicagoToday, daysBetween, formatDateOnly, isDateOnly } from "@/lib/dates";

describe("chicagoToday", () => {
  it("uses the Chicago calendar date, not UTC", () => {
    // 03:30 UTC on Nov 25 is still the evening of Nov 24 in Chicago (CST, UTC-6).
    expect(chicagoToday(new Date("2026-11-25T03:30:00Z"))).toBe("2026-11-24");
    expect(chicagoToday(new Date("2026-11-25T06:00:00Z"))).toBe("2026-11-25");
  });

  it("follows daylight saving time", () => {
    // In July Chicago is UTC-5, so local midnight is 05:00 UTC.
    expect(chicagoToday(new Date("2026-07-02T04:59:59Z"))).toBe("2026-07-01");
    expect(chicagoToday(new Date("2026-07-02T05:00:00Z"))).toBe("2026-07-02");
  });
});

describe("date-only helpers", () => {
  it("counts whole calendar days", () => {
    expect(daysBetween("2026-11-24", "2026-11-24")).toBe(0);
    expect(daysBetween("2026-11-24", "2026-12-24")).toBe(30);
    expect(daysBetween("2026-11-24", "2026-11-23")).toBe(-1);
    // Across a DST change the count is still calendar days.
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
  });

  it("adds days", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(() => addDays("2026-03-01", 1.5)).toThrow();
  });

  it("validates calendar dates", () => {
    expect(isDateOnly("2026-02-28")).toBe(true);
    expect(isDateOnly("2026-02-30")).toBe(false);
    expect(isDateOnly("2026-2-3")).toBe(false);
    expect(isDateOnly("2026-11-24T00:00:00Z")).toBe(false);
    expect(() => daysBetween("nope", "2026-01-01")).toThrow();
  });

  it("formats without shifting the day", () => {
    expect(formatDateOnly("2026-01-01")).toBe("Jan 1, 2026");
  });
});
