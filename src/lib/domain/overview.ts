import type { Enums } from "@/lib/database.types";
import { computeReadiness, type Readiness } from "@/lib/domain/readiness";
import { isGreen, type DeadlineStatus, type EvidenceStatus } from "@/lib/domain/status";

/** Overview counts, derived from status rows. Nothing here is typed in by a user (rule 5). */

export type OverviewRow = {
  evidenceStatus: EvidenceStatus;
  deadlineStatus: DeadlineStatus;
  closedAt: string | null;
  authorityCode: Enums<"authority_code">;
  criticality: Enums<"criticality"> | null;
  subjectType?: Enums<"applicability_scope"> | null;
  subjectId?: string | null;
  category?: string | null;
};

export type AreaKey = "DHS" | "STARS" | "APPLE" | "Staff" | "Child files" | "Safety";

export type OverviewSummary = {
  overdue: number;
  dueSoon: number;
  missingEvidence: number;
  awaitingReview: number;
  unknown: number;
  /** Safety-critical items that are not green. Shown regardless of readiness percentage. */
  safetyCriticalExceptions: number;
  /** Staff whose every open item is green, out of staff who have any applicable item. */
  staffVerified: number;
  staffTotal: number;
  readiness: Readiness;
  readinessByArea: { area: AreaKey; readiness: Readiness; unknown: number }[];
};

const AREAS: { area: AreaKey; test: (r: OverviewRow) => boolean }[] = [
  { area: "DHS", test: (r) => r.authorityCode === "DHS" },
  { area: "STARS", test: (r) => r.authorityCode === "STARS" },
  { area: "APPLE", test: (r) => r.authorityCode === "APPLE" },
  { area: "Staff", test: (r) => r.subjectType === "staff" || r.subjectType === "role" },
  { area: "Child files", test: (r) => r.subjectType === "child" },
  { area: "Safety", test: (r) => r.criticality === "safety_critical" || (r.category ?? "").toLowerCase() === "safety" },
];

export function summarizeOverview(rows: readonly OverviewRow[]): OverviewSummary {
  // Closed cycles are history. Approved not-applicable items are out of scope.
  const open = rows.filter((r) => r.closedAt === null && r.evidenceStatus !== "not_applicable");
  const count = (test: (r: OverviewRow) => boolean) => open.filter(test).length;

  const staff = new Map<string, boolean>();
  for (const r of open) {
    if ((r.subjectType === "staff" || r.subjectType === "role") && r.subjectId) {
      staff.set(r.subjectId, (staff.get(r.subjectId) ?? true) && isGreen(r.evidenceStatus, r.deadlineStatus));
    }
  }

  return {
    overdue: count((r) => r.deadlineStatus === "overdue"),
    dueSoon: count((r) => r.deadlineStatus === "due_soon" || r.deadlineStatus === "urgent"),
    missingEvidence: count((r) => r.evidenceStatus === "missing" || r.evidenceStatus === "needs_correction"),
    awaitingReview: count((r) => r.evidenceStatus === "pending_review"),
    unknown: count((r) => r.evidenceStatus === "unknown"),
    safetyCriticalExceptions: count((r) => r.criticality === "safety_critical" && !isGreen(r.evidenceStatus, r.deadlineStatus)),
    staffVerified: [...staff.values()].filter(Boolean).length,
    staffTotal: staff.size,
    readiness: computeReadiness(rows),
    readinessByArea: AREAS.map(({ area, test }) => {
      const inArea = rows.filter(test);
      return {
        area,
        readiness: computeReadiness(inArea),
        unknown: inArea.filter((r) => r.closedAt === null && r.evidenceStatus === "unknown").length,
      };
    }),
  };
}

/** Action-queue order: safety-critical first, then by how badly the item is off. */
export function actionRank(r: Pick<OverviewRow, "evidenceStatus" | "deadlineStatus" | "criticality">): number | null {
  if (r.evidenceStatus === "not_applicable" || isGreen(r.evidenceStatus, r.deadlineStatus)) return null;
  let rank = 50;
  if (r.deadlineStatus === "overdue") rank = 10;
  else if (r.evidenceStatus === "needs_correction") rank = 20;
  else if (r.deadlineStatus === "urgent") rank = 25;
  else if (r.evidenceStatus === "missing") rank = 30;
  else if (r.evidenceStatus === "pending_review") rank = 35;
  else if (r.deadlineStatus === "due_soon") rank = 40;
  else if (r.evidenceStatus === "unknown") rank = 60;
  return r.criticality === "safety_critical" ? rank - 9 : rank;
}

export function nextAction(evidence: EvidenceStatus, deadline: DeadlineStatus): string {
  if (evidence === "unknown") return "Director: confirm the requirement's source";
  if (evidence === "needs_correction") return "Owner: correct and resubmit";
  if (evidence === "pending_review") return "Director: review the submission";
  if (evidence === "missing") return "Owner: upload evidence";
  if (deadline === "overdue") return "Owner: renew now";
  if (deadline === "urgent" || deadline === "due_soon") return "Owner: prepare the renewal";
  return "None";
}
