import { describe, expect, it } from "vitest";
import { actionRank, summarizeOverview, type OverviewRow } from "@/lib/domain/overview";

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

  it("counts a staff member as verified only when every open item is green", () => {
    const s = summarizeOverview([
      row({ subjectType: "staff", subjectId: "a", evidenceStatus: "verified", deadlineStatus: "current" }),
      row({ subjectType: "staff", subjectId: "a", evidenceStatus: "verified" }),
      row({ subjectType: "staff", subjectId: "b", evidenceStatus: "verified" }),
      row({ subjectType: "staff", subjectId: "b", evidenceStatus: "pending_review" }),
      row({ subjectType: "staff", subjectId: "c", evidenceStatus: "verified", deadlineStatus: "due_soon" }),
    ]);
    expect(s.staffVerified).toBe(1);
    expect(s.staffTotal).toBe(3);
  });

  it("puts safety-critical and overdue work first and leaves green items out", () => {
    expect(actionRank({ evidenceStatus: "verified", deadlineStatus: "current", criticality: null })).toBeNull();
    expect(actionRank({ evidenceStatus: "not_applicable", deadlineStatus: "overdue", criticality: null })).toBeNull();
    const overdue = actionRank({ evidenceStatus: "verified", deadlineStatus: "overdue", criticality: null })!;
    const missing = actionRank({ evidenceStatus: "missing", deadlineStatus: "none", criticality: null })!;
    const criticalMissing = actionRank({ evidenceStatus: "missing", deadlineStatus: "none", criticality: "safety_critical" })!;
    const unknown = actionRank({ evidenceStatus: "unknown", deadlineStatus: "none", criticality: null })!;
    expect(overdue).toBeLessThan(missing);
    expect(criticalMissing).toBeLessThan(missing);
    expect(missing).toBeLessThan(unknown);
  });

  it("reports N/A per authority with nothing applicable", () => {
    const s = summarizeOverview([row({ evidenceStatus: "verified" })]);
    const apple = s.readinessByArea.find((a) => a.area === "APPLE");
    expect(apple?.readiness.basisPoints).toBeNull();
    expect(s.readinessByArea.map((a) => a.area)).toEqual(["DHS", "STARS", "APPLE", "Staff", "Child files", "Safety"]);
  });
});
