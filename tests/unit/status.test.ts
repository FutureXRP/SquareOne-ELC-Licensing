import { describe, expect, it } from "vitest";
import {
  deriveDeadlineStatus,
  deriveEvidenceStatus,
  isGreen,
  statusTone,
  type EvidenceStatusInput,
  type LinkFact,
} from "@/lib/domain/status";

const TODAY = "2026-11-24";

const base: EvidenceStatusInput = {
  naApprovedBy: null,
  naReason: null,
  versionStatus: "active",
  lastSourceReview: "2026-10-01",
  links: [],
};

function link(partial: Partial<LinkFact> & Pick<LinkFact, "status">): LinkFact {
  return {
    id: partial.id ?? "link-1",
    createdAt: partial.createdAt ?? "2026-11-01T12:00:00Z",
    reviewedAt: partial.reviewedAt ?? (partial.status === "pending" ? null : "2026-11-02T12:00:00Z"),
    evidenceExpiryDate: partial.evidenceExpiryDate ?? null,
    status: partial.status,
  };
}

describe("deriveEvidenceStatus", () => {
  it("is missing with no evidence", () => {
    expect(deriveEvidenceStatus(base, TODAY)).toBe("missing");
  });

  it("is not_applicable only with an approver and a reason", () => {
    expect(deriveEvidenceStatus({ ...base, naApprovedBy: "dir", naReason: "No infants enrolled" }, TODAY)).toBe(
      "not_applicable",
    );
    expect(deriveEvidenceStatus({ ...base, naApprovedBy: "dir", naReason: "  " }, TODAY)).toBe("missing");
    expect(deriveEvidenceStatus({ ...base, naApprovedBy: null, naReason: "wishful" }, TODAY)).toBe("missing");
  });

  it("is unknown when the version is not active or has no source review, even with approved evidence", () => {
    const links = [link({ status: "approved" })];
    for (const versionStatus of ["draft", "superseded", "archived"] as const) {
      expect(deriveEvidenceStatus({ ...base, versionStatus, links }, TODAY)).toBe("unknown");
    }
    expect(deriveEvidenceStatus({ ...base, lastSourceReview: null, links }, TODAY)).toBe("unknown");
  });

  it("does not treat an upload as compliance", () => {
    expect(deriveEvidenceStatus({ ...base, links: [link({ status: "pending" })] }, TODAY)).toBe("pending_review");
  });

  it("is verified only through an approved link to unexpired evidence", () => {
    expect(deriveEvidenceStatus({ ...base, links: [link({ status: "approved" })] }, TODAY)).toBe("verified");
    expect(
      deriveEvidenceStatus({ ...base, links: [link({ status: "approved", evidenceExpiryDate: TODAY })] }, TODAY),
    ).toBe("verified");
  });

  it("never reads an expired document as verified", () => {
    const expired = link({ status: "approved", evidenceExpiryDate: "2026-11-23" });
    expect(deriveEvidenceStatus({ ...base, links: [expired] }, TODAY)).toBe("missing");
    expect(
      deriveEvidenceStatus({ ...base, links: [expired, link({ id: "link-2", status: "pending" })] }, TODAY),
    ).toBe("pending_review");
  });

  it("needs correction when the most recent decision is a rejection", () => {
    const rejected = link({ status: "rejected", reviewedAt: "2026-11-10T12:00:00Z" });
    expect(deriveEvidenceStatus({ ...base, links: [rejected] }, TODAY)).toBe("needs_correction");
    // An older pending submission does not hide the rejection.
    const olderPending = link({ id: "link-2", status: "pending", createdAt: "2026-11-09T12:00:00Z" });
    expect(deriveEvidenceStatus({ ...base, links: [rejected, olderPending] }, TODAY)).toBe("needs_correction");
  });

  it("returns to pending review when a corrected submission arrives after the rejection", () => {
    const rejected = link({ status: "rejected", reviewedAt: "2026-11-10T12:00:00Z" });
    const resubmitted = link({ id: "link-2", status: "pending", createdAt: "2026-11-11T12:00:00Z" });
    expect(deriveEvidenceStatus({ ...base, links: [rejected, resubmitted] }, TODAY)).toBe("pending_review");
  });

  it("lets an approval outrank an earlier or later rejection of other evidence", () => {
    const approved = link({ status: "approved", reviewedAt: "2026-11-05T12:00:00Z" });
    const rejectedLater = link({ id: "link-2", status: "rejected", reviewedAt: "2026-11-10T12:00:00Z" });
    expect(deriveEvidenceStatus({ ...base, links: [approved, rejectedLater] }, TODAY)).toBe("verified");
  });
});

describe("deriveDeadlineStatus", () => {
  it("covers every boundary with the default thresholds", () => {
    expect(deriveDeadlineStatus(null, TODAY)).toBe("none");
    expect(deriveDeadlineStatus("2026-11-23", TODAY)).toBe("overdue");
    expect(deriveDeadlineStatus("2026-11-24", TODAY)).toBe("urgent"); // due today
    expect(deriveDeadlineStatus("2026-12-01", TODAY)).toBe("urgent"); // 7 days
    expect(deriveDeadlineStatus("2026-12-02", TODAY)).toBe("due_soon"); // 8 days
    expect(deriveDeadlineStatus("2026-12-24", TODAY)).toBe("due_soon"); // 30 days
    expect(deriveDeadlineStatus("2026-12-25", TODAY)).toBe("current"); // 31 days
  });

  it("uses director-edited thresholds", () => {
    expect(deriveDeadlineStatus("2026-12-04", TODAY, { urgentDays: 10, dueSoonDays: 60 })).toBe("urgent");
    expect(deriveDeadlineStatus("2027-01-10", TODAY, { urgentDays: 10, dueSoonDays: 60 })).toBe("due_soon");
  });
});

describe("green rule", () => {
  it("is green only for verified evidence with a current or absent deadline", () => {
    const evidence = ["missing", "pending_review", "needs_correction", "verified", "not_applicable", "unknown"] as const;
    const deadline = ["none", "current", "due_soon", "urgent", "overdue"] as const;
    for (const e of evidence) {
      for (const d of deadline) {
        const expected = e === "verified" && (d === "none" || d === "current");
        expect(isGreen(e, d)).toBe(expected);
        expect(statusTone(e, d) === "green").toBe(expected);
      }
    }
  });

  it("never colors unknown or pending green", () => {
    expect(statusTone("unknown", "none")).toBe("neutral");
    expect(statusTone("pending_review", "current")).toBe("amber");
    expect(statusTone("verified", "overdue")).toBe("red");
  });
});
