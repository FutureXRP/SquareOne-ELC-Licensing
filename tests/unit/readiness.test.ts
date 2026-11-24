import { describe, expect, it } from "vitest";
import { computeReadiness, formatReadiness, type ReadinessRow } from "@/lib/domain/readiness";
import type { EvidenceStatus } from "@/lib/domain/status";

const rows = (...statuses: EvidenceStatus[]): ReadinessRow[] =>
  statuses.map((evidenceStatus) => ({ evidenceStatus, closedAt: null }));

describe("computeReadiness", () => {
  it("is N/A with zero applicable items, never 0 or 100", () => {
    expect(formatReadiness(computeReadiness([]))).toBe("N/A");
    expect(formatReadiness(computeReadiness(rows("not_applicable", "not_applicable")))).toBe("N/A");
    expect(computeReadiness([]).basisPoints).toBeNull();
  });

  it("excludes approved not-applicable items from numerator and denominator", () => {
    const r = computeReadiness(rows("verified", "not_applicable", "missing"));
    expect(r).toEqual({ verified: 1, applicable: 2, basisPoints: 5000 });
  });

  it("keeps unknown, missing, pending and needs_correction in the denominator", () => {
    const r = computeReadiness(rows("verified", "unknown", "missing", "pending_review", "needs_correction"));
    expect(r).toEqual({ verified: 1, applicable: 5, basisPoints: 2000 });
  });

  it("does not let unknown requirements raise readiness", () => {
    const before = computeReadiness(rows("verified", "missing"));
    const after = computeReadiness(rows("verified", "missing", "unknown", "unknown"));
    expect(after.basisPoints!).toBeLessThan(before.basisPoints!);
  });

  it("ignores closed cycles", () => {
    const r = computeReadiness([
      { evidenceStatus: "verified", closedAt: "2026-01-01T00:00:00Z" },
      { evidenceStatus: "missing", closedAt: null },
    ]);
    expect(r).toEqual({ verified: 0, applicable: 1, basisPoints: 0 });
  });

  it("uses integer basis points", () => {
    const r = computeReadiness(rows("verified", "missing", "missing"));
    expect(r.basisPoints).toBe(3333);
    expect(Number.isInteger(r.basisPoints)).toBe(true);
    expect(formatReadiness(r)).toBe("33.3%");
  });

  it("only displays 100% when everything applicable is verified", () => {
    const almost = computeReadiness([...rows("missing"), ...Array<EvidenceStatus>(1999).fill("verified").flatMap((s) => rows(s))]);
    expect(formatReadiness(almost)).toBe("99.9%");
    expect(formatReadiness(computeReadiness(rows("verified", "verified")))).toBe("100%");
    expect(formatReadiness(computeReadiness(rows("unknown")))).toBe("0.0%");
  });
});
