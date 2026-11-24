import type { Metadata } from "next";
import { CalendarClock, CircleHelp, ClipboardCheck, FileQuestion, Hourglass, ShieldAlert, TriangleAlert } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { summarizeOverview, type OverviewRow } from "@/lib/domain/overview";
import { formatReadiness, READINESS_DISCLAIMER } from "@/lib/domain/readiness";
import { chicagoToday, formatDateOnly } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

const PAGE_SIZE = 1000;

/** Every status row the signed-in user may see (RLS decides), paged past the API row limit. */
async function loadStatusRows(): Promise<{ rows: OverviewRow[]; error: boolean }> {
  const supabase = await createClient();
  const rows: OverviewRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("v_requirement_status")
      .select("requirement_instance_id, evidence_status, deadline_status, closed_at, authority_code, criticality")
      .order("requirement_instance_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows: [], error: true };
    for (const r of data) {
      if (r.evidence_status === null || r.deadline_status === null || r.authority_code === null) continue;
      rows.push({
        evidenceStatus: r.evidence_status,
        deadlineStatus: r.deadline_status,
        closedAt: r.closed_at,
        authorityCode: r.authority_code,
        criticality: r.criticality,
      });
    }
    if (data.length < PAGE_SIZE) return { rows, error: false };
  }
}

export default async function OverviewPage() {
  await requirePermission("overview.read");
  const supabase = await createClient();
  const [{ data: program }, status] = await Promise.all([
    supabase.from("programs").select("name, licensed_capacity").is("archived_at", null).limit(1).maybeSingle(),
    loadStatusRows(),
  ]);
  const summary = summarizeOverview(status.rows);
  const empty = status.rows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            {program?.name ?? "Program not set up"} · Licensed capacity:{" "}
            {program?.licensed_capacity ?? "Not confirmed"}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">As of {formatDateOnly(chicagoToday())} (Central time)</p>
      </div>

      {status.error ? (
        <p role="alert" className="rounded-md bg-status-red-bg px-4 py-3 text-sm text-status-red">
          Statuses could not be loaded. Nothing below should be read as current.
        </p>
      ) : null}

      {summary.safetyCriticalExceptions > 0 ? (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-status-red bg-status-red-bg px-4 py-3 text-status-red">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm font-medium">
            {summary.safetyCriticalExceptions} safety-critical{" "}
            {summary.safetyCriticalExceptions === 1 ? "item needs" : "items need"} attention, regardless of the
            readiness percentage.
          </p>
        </div>
      ) : null}

      <section aria-label="Counts" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Overdue" value={String(summary.overdue)} icon={TriangleAlert} tone={summary.overdue > 0 ? "red" : "neutral"} />
        <StatCard label="Due in 30 days" value={String(summary.dueSoon)} icon={CalendarClock} tone={summary.dueSoon > 0 ? "amber" : "neutral"} />
        <StatCard label="Missing evidence" value={String(summary.missingEvidence)} icon={FileQuestion} tone={summary.missingEvidence > 0 ? "red" : "neutral"} />
        <StatCard label="Awaiting review" value={String(summary.awaitingReview)} icon={Hourglass} tone={summary.awaitingReview > 0 ? "amber" : "neutral"} />
        <StatCard
          label="Requirements verified"
          value={`${summary.readiness.verified} of ${summary.readiness.applicable}`}
          icon={ClipboardCheck}
          tone={summary.readiness.applicable > 0 && summary.readiness.verified === summary.readiness.applicable ? "green" : "neutral"}
        />
      </section>

      {summary.unknown > 0 ? (
        <div className="flex items-start gap-3 rounded-md border border-border bg-status-neutral-bg px-4 py-3">
          <CircleHelp className="mt-0.5 size-5 shrink-0 text-status-neutral" aria-hidden />
          <p className="text-sm">
            <span className="font-medium">{summary.unknown} items are unknown.</span> Their requirement has no confirmed
            source, citation and review date yet, so they cannot be verified and they count against readiness.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Program readiness by area</CardTitle>
          <CardDescription>{READINESS_DISCLAIMER}</CardDescription>
        </CardHeader>
        <CardContent>
          {empty ? (
            <p className="text-sm text-muted-foreground">
              No requirements are assigned to you yet. Readiness appears here once there are records to compute it from.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Area</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Readiness</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Verified</th>
                    <th scope="col" className="py-2 text-right font-medium">Unknown</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.readinessByAuthority.map((a) => (
                    <tr key={a.authorityCode} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 pr-4 text-left font-medium">{a.authorityCode}</th>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatReadiness(a.readiness)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                        {a.readiness.verified} of {a.readiness.applicable}
                      </td>
                      <td className="py-2 text-right tabular-nums">{a.unknown}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <th scope="row" className="pt-3 pr-4 text-left">All areas</th>
                    <td className="pt-3 pr-4 text-right tabular-nums">{formatReadiness(summary.readiness)}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums whitespace-nowrap">
                      {summary.readiness.verified} of {summary.readiness.applicable}
                    </td>
                    <td className="pt-3 text-right tabular-nums">{summary.unknown}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        The action queue, upcoming deadlines, recent activity, search and filters arrive in build phase 2.
      </p>
    </div>
  );
}
