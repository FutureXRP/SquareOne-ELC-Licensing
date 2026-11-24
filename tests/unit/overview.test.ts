import { describe, expect, it } from "vitest";
import { summarizeOverview, type OverviewRow } from "@/lib/domain/overview";

const row = (partial: Partial<OverviewRow>): OverviewRow => ({
  evidenceStatus: "missing",
  deadlineStatus: "none",
  closedAt: null,
  authorityCode: "DHS",
  criticality: null,
  ...partial,
});

describe("summarizeOverview", () => {
  it("counts each card from records", () => {
    const s = summarizeOverview([
      row({ evidenceStatus: "verified", deadlineStatus: "current" }),
      row({ evidenceStatus: "verified", deadlineStatus: "overdue" }),
      row({ evidenceStatus: "missing", deadlineStatus: "urgent" }),
      row({ evidenceStatus: "needs_correction", deadlineStatus: "due_soon" }),
      row({ evidenceStatus: "pending_review" }),
      row({ evidenceStatus: "unknown", authorityCode: "STARS" }),
      row({ evidenceStatus: "not_applicable", deadlineStatus: "overdue" }),
      row({ evidenceStatus: "missing", deadlineStatus: "overdue", closedAt: "2026-01-01T00:00:00Z" }),
    ]);
    expect(s.overdue).toBe(1);
    expect(s.dueSoon).toBe(2);
    expect(s.missingEvidence).toBe(2);
    expect(s.awaitingReview).toBe(1);
    expect(s.unknown).toBe(1);
    expect(s.readiness).toEqual({ verified: 2, applicable: 6, basisPoints: 3333 });
  });

  it("keeps unknown requirements visible and out of the verified count", () => {
    const s = summarizeOverview([row({ evidenceStatus: "unknown" }), row({ evidenceStatus: "unknown" })]);
    expect(s.unknown).toBe(2);
    expect(s.readiness).toEqual({ verified: 0, applicable: 2, basisPoints: 0 });
  });

  it("flags safety-critical exceptions regardless of readiness", () => {
    const rows = [
      ...Array.from({ length: 99 }, () => row({ evidenceStatus: "verified", deadlineStatus: "current" })),
      row({ evidenceStatus: "verified", deadlineStatus: "overdue", criticality: "safety_critical" }),
    ];
    const s = summarizeOverview(rows);
    expect(s.readiness.basisPoints).toBe(10_000);
    expect(s.safetyCriticalExceptions).toBe(1);
  });

  it("reports N/A per authority with nothing applicable", () => {
    const s = summarizeOverview([row({ evidenceStatus: "verified" })]);
    const apple = s.readinessByAuthority.find((a) => a.authorityCode === "APPLE");
    expect(apple?.readiness.basisPoints).toBeNull();
    expect(s.readinessByAuthority.map((a) => a.authorityCode)).toEqual(["DHS", "STARS", "APPLE", "CECPD", "INTERNAL"]);
  });
});
