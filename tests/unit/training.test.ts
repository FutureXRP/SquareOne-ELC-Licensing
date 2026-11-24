import { describe, expect, it } from "vitest";
import { formatMinutes, summarizeTraining } from "@/lib/domain/training";

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
