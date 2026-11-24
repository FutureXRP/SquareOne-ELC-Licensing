import type { Metadata } from "next";
import Link from "next/link";
import { reviewLink } from "@/actions/evidence";
import { ActionForm } from "@/components/forms/ActionForm";
import { Textarea } from "@/components/forms/fields";
import { Empty, PageHeader, Section } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, profileNames } from "@/lib/data";
import { chicagoToday, formatDateOnly } from "@/lib/dates";
import { describeRule, nextDueDate, parseRecurrenceRule } from "@/lib/domain/deadlines";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const session = await requirePermission("overview.read");
  const db = await createClient();
  const queue = await fetchAll((a, b) => db.from("v_review_queue").select("*").eq("status", "pending").order("submitted_at").range(a, b));
  const names = await profileNames(db, queue.map((q) => q.uploader_id));
  const reviewer = can(session.role, "evidence.review");
  const today = chicagoToday();

  return (
    <>
      <PageHeader title="Review queue" description={reviewer ? "Approve a submission or return it with a correction note. Decisions are final and recorded in your name." : "Your submissions waiting for a director's review."} />
      {queue.length === 0 ? <Section title="Waiting for review"><Empty>Nothing is waiting for review.</Empty></Section> : null}
      {queue.map((q) => {
        const rule = parseRecurrenceRule(q.recurrence_rule);
        const recurring = q.frequency === "recurring" || q.frequency === "expiration_based";
        const next = recurring
          ? nextDueDate(rule ?? (q.frequency === "expiration_based" ? { type: "expiration", source: "evidence.expiry_date" } : null), { verifiedOn: today, previousDue: q.due_date, hireDate: q.subject_hire_date, evidenceExpiry: q.expiry_date })
          : null;
        const expired = q.expiry_date !== null && q.expiry_date < today;
        return (
          <Section key={q.link_id} title={`${q.requirement_title} · ${q.subject_label ?? ""}`} description={`${q.requirement_code} · ${q.authority_code} · submitted by ${(q.uploader_id && names.get(q.uploader_id)) || "unknown"}`}>
            <div className="flex flex-col gap-2 text-sm">
              <p>
                <a className="font-medium text-primary hover:underline" href={`/api/evidence/signed-url?id=${q.evidence_id}`} target="_blank" rel="noreferrer">Open {q.file_name}</a>{" "}
                <span className="text-muted-foreground">({q.doc_type}{q.expiry_date ? `, expires ${formatDateOnly(q.expiry_date)}` : ""})</span>
              </p>
              {expired ? <Badge tone="red">This document is already expired. Approving it will not verify the requirement.</Badge> : null}
              {q.version_status !== "active" ? <Badge>Requirement source not confirmed: it cannot be approved yet.</Badge> : null}
              <p className="text-muted-foreground">
                {q.instance_verified_at && recurring ? "Renewal: approving closes the current cycle and opens the next one. " : ""}
                {recurring ? `${describeRule(rule)}. Next due if approved today: ${next ? formatDateOnly(next) : "no date from this rule"}.` : "No recurring deadline."}
              </p>
              <Link className="text-primary hover:underline" href={`/items/${q.requirement_instance_id}`}>Open the item and its history</Link>
            </div>
            {reviewer ? (
              <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                <ActionForm action={reviewLink} submitLabel="Approve">
                  <input type="hidden" name="link_id" value={q.link_id!} />
                  <input type="hidden" name="decision" value="approved" />
                </ActionForm>
                <ActionForm action={reviewLink} submitLabel="Return for correction" variant="outline">
                  <input type="hidden" name="link_id" value={q.link_id!} />
                  <input type="hidden" name="decision" value="rejected" />
                  <Textarea name="correction_note" required maxLength={1000} placeholder="What needs correcting?" aria-label="Correction note" />
                </ActionForm>
              </div>
            ) : null}
          </Section>
        );
      })}
    </>
  );
}
