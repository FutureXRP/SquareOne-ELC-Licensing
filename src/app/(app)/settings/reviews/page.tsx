import type { Metadata } from "next";
import { openReviewCycle, signOffReviewCycle } from "@/actions/program";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, SelectField, TextField } from "@/components/forms/fields";
import { Empty, PageHeader, Section } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requireRole } from "@/lib/auth/session";
import { fetchAll, profileNames } from "@/lib/data";
import { chicagoToday } from "@/lib/dates";
import type { OverviewSummary } from "@/lib/domain/overview";
import { formatReadiness } from "@/lib/domain/readiness";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Quarterly reviews" };

type Snapshot = { taken_on: string; notes: string | null; summary: OverviewSummary; item_count: number };

export default async function ReviewsPage() {
  const session = await requireRole("director", "admin_support");
  const db = await createClient();
  const [cycles, results] = await Promise.all([
    fetchAll((a, b) => db.from("review_cycles").select("*").order("year", { ascending: false }).order("quarter", { ascending: false }).range(a, b)),
    fetchAll((a, b) => db.from("review_results").select("*").range(a, b)),
  ]);
  const names = await profileNames(db, cycles.map((c) => c.signed_off_by));
  const director = can(session.role, "settings.manage");
  const [year, month] = chicagoToday().split("-").map(Number);

  return (
    <>
      <PageHeader title="Quarterly reviews" description="Reviews are held in January, April, July and October. Sign-off saves a dated snapshot that cannot be changed and keeps the open follow-ups." />
      {director ? (
        <Section title="Open a review">
          <ActionForm action={openReviewCycle} submitLabel="Open review">
            <FormGrid>
              <SelectField label="Quarter" name="quarter" defaultValue={String(Math.floor((month - 1) / 3) + 1)} options={[1, 2, 3, 4].map((q) => ({ value: String(q), label: `Q${q}` }))} />
              <TextField label="Year" name="year" type="number" required defaultValue={year} min={2020} max={2100} />
            </FormGrid>
          </ActionForm>
        </Section>
      ) : null}
      {cycles.length === 0 ? <Section title="Reviews"><Empty>No reviews yet.</Empty></Section> : null}
      {cycles.map((c) => {
        const result = results.find((r) => r.cycle_id === c.id);
        const snap = result ? (result.snapshot as unknown as Snapshot) : null;
        const exceptions = result && Array.isArray(result.exceptions) ? (result.exceptions as { code: string; title: string; subject: string | null; evidence: string; deadline: string }[]) : [];
        return (
          <Section key={c.id} title={`Q${c.quarter} ${c.year}`} description={`Opened ${new Date(c.opened_at).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}`}>
            {c.signed_off_at && snap ? (
              <div className="text-sm">
                <Badge tone="green">Signed off {new Date(c.signed_off_at).toLocaleDateString("en-US", { timeZone: "America/Chicago" })} by {(c.signed_off_by && names.get(c.signed_off_by)) || "director"}</Badge>
                <p className="mt-2">Snapshot taken {snap.taken_on}: readiness {formatReadiness(snap.summary.readiness)} ({snap.summary.readiness.verified} of {snap.summary.readiness.applicable} verified), {snap.summary.overdue} overdue, {snap.summary.missingEvidence} missing evidence, {snap.summary.unknown} unknown.</p>
                <p>{exceptions.length} exception{exceptions.length === 1 ? "" : "s"} recorded · {result?.follow_up_task_ids.length ?? 0} open follow-up task{result?.follow_up_task_ids.length === 1 ? "" : "s"} kept.</p>
                {snap.notes ? <p className="mt-1">Notes: {snap.notes}</p> : null}
                {exceptions.length > 0 ? (
                  <details className="mt-2"><summary className="cursor-pointer text-primary">Exceptions at sign-off</summary>
                    <ul className="mt-1 list-disc pl-5">{exceptions.slice(0, 200).map((e, i) => <li key={i}>{e.code} · {e.title} · {e.subject ?? ""} ({e.evidence.replace("_", " ")}, {e.deadline.replace("_", " ")})</li>)}</ul>
                  </details>
                ) : null}
              </div>
            ) : director ? (
              <ActionForm action={signOffReviewCycle} submitLabel="Sign off and save snapshot" confirm="Sign off this review? The snapshot cannot be changed afterwards.">
                <input type="hidden" name="cycle_id" value={c.id} />
                <TextField label="Notes (optional)" name="notes" maxLength={2000} />
              </ActionForm>
            ) : <Badge tone="amber">Open</Badge>}
          </Section>
        );
      })}
    </>
  );
}
