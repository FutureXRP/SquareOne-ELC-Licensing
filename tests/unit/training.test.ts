import { describe, expect, it } from "vitest";
import { formatMinutes, inWindow, pdlRenewalYear, pdlTargetMinutes, summarizeTraining } from "@/lib/domain/training";

describe("summarizeTraining", () => {
  it("separates verified, pending and remaining minutes", () => {
    const s = summarizeTraining(
      [
        { minutes: 120, state: "verified" },
        { minutes: 90, state: "pending" },
        { minutes: 600, state: "ineligible" },
      ],
      1800,
    );
    expect(s).toEqual({ verifiedMinutes: 120, pendingMinutes: 90, targetMinutes: 1800, remainingMinutes: 1680 });
  });

  it("never counts pending or ineligible minutes toward the target", () => {
    const s = summarizeTraining([{ minutes: 1800, state: "pending" }], 1800);
    expect(s.remainingMinutes).toBe(1800);
  });

  it("does not go below zero and handles a missing target", () => {
    expect(summarizeTraining([{ minutes: 2000, state: "verified" }], 1800).remainingMinutes).toBe(0);
    expect(summarizeTraining([{ minutes: 60, state: "verified" }], null).remainingMinutes).toBeNull();
  });

  it("rejects fractional minutes", () => {
    expect(() => summarizeTraining([{ minutes: 1.5, state: "verified" }], 1800)).toThrow();
  });

  it("formats minutes", () => {
    expect(formatMinutes(1800)).toBe("30 h");
    expect(formatMinutes(95)).toBe("1 h 35 min");
    expect(formatMinutes(45)).toBe("45 min");
  });
});

describe("PDL renewal year", () => {
  it("is the 12 months ending on the renewal date, not the calendar year", () => {
    expect(pdlRenewalYear("2027-03-15")).toEqual({ start: "2026-03-16", end: "2027-03-15" });
    expect(pdlRenewalYear("2028-02-29")).toEqual({ start: "2027-03-01", end: "2028-02-29" });
    const window = pdlRenewalYear("2027-03-15");
    expect(inWindow("2026-03-15", window)).toBe(false);
    expect(inWindow("2026-03-16", window)).toBe(true);
    expect(inWindow("2027-03-15", window)).toBe(true);
    expect(inWindow("2027-03-16", window)).toBe(false);
  });

  it("uses only targets a director has confirmed from the official source", () => {
    const targets = [
      { level_min: 1, level_max: 1, target_minutes: 720, confirmed: true },
      { level_min: 2, level_max: 11, target_minutes: 1200, confirmed: false },
    ];
    expect(pdlTargetMinutes(1, targets)).toBe(720);
    expect(pdlTargetMinutes(5, targets)).toBeNull(); // unconfirmed: no target is assumed
    expect(pdlTargetMinutes(null, targets)).toBeNull();
    expect(pdlTargetMinutes(5, [{ ...targets[1], confirmed: true }])).toBe(1200);
  });
});
