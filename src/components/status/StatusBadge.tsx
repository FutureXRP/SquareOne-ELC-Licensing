import { CircleAlert, CircleCheck, CircleDashed, CircleHelp, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DEADLINE_STATUS_LABEL,
  EVIDENCE_STATUS_LABEL,
  isGreen,
  type DeadlineStatus,
  type EvidenceStatus,
} from "@/lib/domain/status";

const EVIDENCE_TONE: Record<EvidenceStatus, "green" | "amber" | "red" | "neutral"> = {
  verified: "green",
  pending_review: "amber",
  needs_correction: "red",
  missing: "red",
  unknown: "neutral",
  not_applicable: "neutral",
};

const DEADLINE_TONE: Record<DeadlineStatus, "green" | "amber" | "red" | "neutral"> = {
  none: "neutral",
  current: "neutral",
  due_soon: "amber",
  urgent: "red",
  overdue: "red",
};

/**
 * Shows the evidence status and, when there is a deadline, the deadline status beside it.
 * The evidence badge is green only when the pair is green: verified evidence with an
 * overdue or approaching deadline is shown in neutral so it can never read as "all clear".
 */
export function StatusBadge({ evidence, deadline }: { evidence: EvidenceStatus; deadline: DeadlineStatus }) {
  const green = isGreen(evidence, deadline);
  const evidenceTone = evidence === "verified" && !green ? "neutral" : EVIDENCE_TONE[evidence];
  const Icon =
    evidence === "verified"
      ? CircleCheck
      : evidence === "unknown"
        ? CircleHelp
        : evidence === "pending_review"
          ? Clock
          : evidence === "not_applicable"
            ? CircleDashed
            : CircleAlert;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={evidenceTone}>
        <Icon className="size-3.5" aria-hidden />
        {EVIDENCE_STATUS_LABEL[evidence]}
      </Badge>
      {deadline !== "none" && (deadline !== "current" || evidence !== "verified") ? (
        <Badge tone={DEADLINE_TONE[deadline]}>{DEADLINE_STATUS_LABEL[deadline]}</Badge>
      ) : null}
    </span>
  );
}
