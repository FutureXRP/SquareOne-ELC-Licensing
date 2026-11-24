import { daysBetween, type DateOnly } from "@/lib/dates";
import type { Enums } from "@/lib/database.types";

/**
 * Evidence and deadline status derivation (BUILD.md section 5).
 *
 * Pure functions, no I/O. They must stay in parity with the SQL view
 * `v_requirement_status` (supabase/migrations/0008_status_views.sql);
 * tests/db/status-parity.test.ts compares the two on the same records.
 */

export type EvidenceStatus = Enums<"evidence_status">;
export type DeadlineStatus = Enums<"deadline_status">;

export type LinkFact = {
  id: string;
  status: Enums<"link_status">;
  /** ISO timestamp the link (submission) was created. */
  createdAt: string;
  /** ISO timestamp of the review decision; null while pending. */
  reviewedAt: string | null;
  /** Expiry date of the linked evidence document, if it has one. */
  evidenceExpiryDate: DateOnly | null;
};

export type EvidenceStatusInput = {
  naApprovedBy: string | null;
  naReason: string | null;
  versionStatus: Enums<"lifecycle_status">;
  lastSourceReview: DateOnly | null;
  /** Non-archived links to non-archived evidence. */
  links: readonly LinkFact[];
};

export type Thresholds = { urgentDays: number; dueSoonDays: number };

export const DEFAULT_THRESHOLDS: Thresholds = { urgentDays: 7, dueSoonDays: 30 };

function time(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`Not a timestamp: ${iso}`);
  return t;
}

/** First match wins. Unknown and pending are never verified (rules 3 and 4). */
export function deriveEvidenceStatus(input: EvidenceStatusInput, today: DateOnly): EvidenceStatus {
  if (input.naApprovedBy !== null && (input.naReason ?? "").trim() !== "") {
    return "not_applicable";
  }
  if (input.versionStatus !== "active" || input.lastSourceReview === null) {
    return "unknown";
  }

  const hasValidApproved = input.links.some(
    (l) =>
      l.status === "approved" &&
      (l.evidenceExpiryDate === null || daysBetween(today, l.evidenceExpiryDate) >= 0),
  );
  if (hasValidApproved) return "verified";

  const decided = input.links
    .filter((l) => l.status !== "pending" && l.reviewedAt !== null)
    .sort((a, b) => time(b.reviewedAt!) - time(a.reviewedAt!) || (a.id < b.id ? 1 : -1));
  const pending = input.links.filter((l) => l.status === "pending");
  const lastDecision = decided[0];
  const lastPendingAt = pending.length > 0 ? Math.max(...pending.map((l) => time(l.createdAt))) : null;

  // A rejection stands until a newer submission is waiting for review.
  if (
    lastDecision?.status === "rejected" &&
    (lastPendingAt === null || lastPendingAt <= time(lastDecision.reviewedAt!))
  ) {
    return "needs_correction";
  }
  if (pending.length > 0) return "pending_review";
  return "missing";
}

export function deriveDeadlineStatus(
  dueDate: DateOnly | null,
  today: DateOnly,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): DeadlineStatus {
  if (dueDate === null) return "none";
  const daysLeft = daysBetween(today, dueDate);
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= thresholds.urgentDays) return "urgent";
  if (daysLeft <= thresholds.dueSoonDays) return "due_soon";
  return "current";
}

/** Green requires verified evidence AND a deadline that is current or absent (rule 4). */
export function isGreen(evidence: EvidenceStatus, deadline: DeadlineStatus): boolean {
  return evidence === "verified" && (deadline === "current" || deadline === "none");
}

export type StatusTone = "green" | "amber" | "red" | "neutral";

/** Display tone for the pair of statuses. Anything short of green is never shown green. */
export function statusTone(evidence: EvidenceStatus, deadline: DeadlineStatus): StatusTone {
  if (evidence === "not_applicable") return "neutral";
  if (isGreen(evidence, deadline)) return "green";
  if (deadline === "overdue" || evidence === "missing" || evidence === "needs_correction") return "red";
  if (evidence === "unknown") return "neutral";
  return "amber";
}

export const EVIDENCE_STATUS_LABEL: Record<EvidenceStatus, string> = {
  missing: "Missing evidence",
  pending_review: "Awaiting review",
  needs_correction: "Needs correction",
  verified: "Verified",
  not_applicable: "Not applicable",
  unknown: "Unknown (source not confirmed)",
};

export const DEADLINE_STATUS_LABEL: Record<DeadlineStatus, string> = {
  none: "No deadline",
  current: "Current",
  due_soon: "Due soon",
  urgent: "Urgent",
  overdue: "Overdue",
};
