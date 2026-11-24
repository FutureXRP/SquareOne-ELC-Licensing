import type { Enums } from "@/lib/database.types";
import { computeReadiness, type Readiness } from "@/lib/domain/readiness";
import type { DeadlineStatus, EvidenceStatus } from "@/lib/domain/status";

/** Overview counts, derived from status rows. Nothing here is typed in by a user (rule 5). */

export type OverviewRow = {
  evidenceStatus: EvidenceStatus;
  deadlineStatus: DeadlineStatus;
  closedAt: string | null;
  authorityCode: Enums<"authority_code">;
  criticality: Enums<"criticality"> | null;
};

export type OverviewSummary = {
  overdue: number;
  dueSoon: number;
  missingEvidence: number;
  awaitingReview: number;
  unknown: number;
  /** Safety-critical items that are not green. Shown regardless of readiness percentage. */
  safetyCriticalExceptions: number;
  readiness: Readiness;
  readinessByAuthority: { authorityCode: Enums<"authority_code">; readiness: Readiness; unknown: number }[];
};

const AUTHORITY_ORDER: Enums<"authority_code">[] = ["DHS", "STARS", "APPLE", "CECPD", "INTERNAL"];

export function summarizeOverview(rows: readonly OverviewRow[]): OverviewSummary {
  // Closed cycles are history. Approved not-applicable items are out of scope.
  const open = rows.filter((r) => r.closedAt === null && r.evidenceStatus !== "not_applicable");
  const count = (test: (r: OverviewRow) => boolean) => open.filter(test).length;

  return {
    overdue: count((r) => r.deadlineStatus === "overdue"),
    dueSoon: count((r) => r.deadlineStatus === "due_soon" || r.deadlineStatus === "urgent"),
    missingEvidence: count((r) => r.evidenceStatus === "missing" || r.evidenceStatus === "needs_correction"),
    awaitingReview: count((r) => r.evidenceStatus === "pending_review"),
    unknown: count((r) => r.evidenceStatus === "unknown"),
    safetyCriticalExceptions: count(
      (r) =>
        r.criticality === "safety_critical" &&
        !(r.evidenceStatus === "verified" && (r.deadlineStatus === "current" || r.deadlineStatus === "none")),
    ),
    readiness: computeReadiness(rows),
    readinessByAuthority: AUTHORITY_ORDER.map((authorityCode) => {
      const forAuthority = rows.filter((r) => r.authorityCode === authorityCode);
      return {
        authorityCode,
        readiness: computeReadiness(forAuthority),
        unknown: forAuthority.filter((r) => r.closedAt === null && r.evidenceStatus === "unknown").length,
      };
    }),
  };
}
