import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CircleHelp, ClipboardCheck, FileQuestion, Hourglass, ShieldAlert, TriangleAlert, Users, Wrench } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { fetchAll, profileNames } from "@/lib/data";
import { chicagoToday, formatDateOnly } from "@/lib/dates";
import { actionRank, nextAction, summarizeOverview } from "@/lib/domain/overview";
import { formatReadiness, READINESS_DISCLAIMER } from "@/lib/domain/readiness";
import { DEADLINE_STATUS_LABEL } from "@/lib/domain/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const session = await requireSession();
  if (session.role === "auditor") redirect("/packet");
  if (!can(session.role, "overview.read")) redirect("/no-access");
  const db = await createClient();

  const [{ data: program }, rows, deadlines, openActions, activity] = await Promise.all([
    db.from("programs").select("name, licensed_capacity").is("archived_at", null).limit(1).maybeSingle(),
    fetchAll((a, b) => db.from("v_requirement_status").select("*").is("closed_at", null).order("requirement_instance_id").range(a, b)),
    fetchAll((a, b) => db.from("v_deadline_items").select("*").order("due_date").range(a, b)),
    db.from("corrective_actions").select("id", { count: "exact", head: true }).is("verified_at", null).is("archived_at", null),
    session.role === "director"
      ? db.from("audit_events").select("id, action, entity_table, actor_id, at").order("at", { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
  ]);

  const usable = rows.filter((r) => r.evidence_status && r.deadline_status && r.authority_code);
  const summary = summarizeOverview(
    usable.map((r) => ({
      evidenceStatus: r.evidence_status!,
      deadlineStatus: r.deadline_status!,
      closedAt: r.closed_at,
      authorityCode: r.authority_code!,
      criticality: r.criticality,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      category: r.requirement_category,
    })),
  );
  // Credentials carry dates too, so the deadline cards count them alongside requirement items.
  const overdue = deadlines.filter((d) => d.deadline_status === "overdue").length;
  const dueSoon = deadlines.filter((d) => d.deadline_status === "due_soon" || d.deadline_status === "urgent").length;

  const queue = usable
    .map((r) => ({ r, rank: actionRank({ evidenceStatus: r.evidence_status!, deadlineStatus: r.deadline_status!, criticality: r.criticality }) }))
    .filter((x): x is { r: (typeof usable)[number]; rank: number } => x.rank !== null)
    .sort((a, b) => a.rank - b.rank || (a.r.due_date ?? "9999").localeCompare(b.r.due_date ?? "9999"))
    .slice(0, 8);
  const upcoming = deadlines.filter((d) => d.deadline_status !== "overdue" && d.due_date! <= addDaysIso(90)).slice(0, 8);
  const names = await profileNames(db, [...queue.map((q) => q.r.owner_id), ...(activity.data ?? []).map((a) => a.actor_id)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description={`${program?.name ?? "Program not set up"} · Licensed capacity: ${program?.licensed_capacity ?? "Not confirmed"} · As of ${formatDateOnly(chicagoToday())} (Central time)`}
      >
        <form action="/items" className="flex gap-2">
          <Input name="q" placeholder="Search items" aria-label="Search items" className="h-9 w-40" />
          <Button type="submit" variant="outline" size="sm">Search</Button>
        </form>
        <Button asChild size="sm"><Link href="/upload">Upload</Link></Button>
        {can(session.role, "tasks.manage") ? <Button asChild size="sm" variant="outline"><Link href="/tasks">Add task</Link></Button> : null}
      </PageHeader>

      {summary.safetyCriticalExceptions > 0 ? (
        <Link href="/items?view=safety" role="alert" className="flex items-start gap-3 rounded-md border border-status-red bg-status-red-bg px-4 py-3 text-status-red">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="text-sm font-medium">
            {summary.safetyCriticalExceptions} safety-critical {summary.safetyCriticalExceptions === 1 ? "item needs" : "items need"} attention,
            regardless of the readiness percentage.
          </span>
        </Link>
      ) : null}

      <section aria-label="Counts" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard href="/items?view=overdue" label="Overdue" value={String(overdue)} icon={TriangleAlert} tone={overdue > 0 ? "red" : "neutral"} />
        <StatCard href="/items?view=due" label="Due in 30 days" value={String(dueSoon)} icon={CalendarClock} tone={dueSoon > 0 ? "amber" : "neutral"} />
        <StatCard href="/items?view=missing" label="Missing evidence" value={String(summary.missingEvidence)} icon={FileQuestion} tone={summary.missingEvidence > 0 ? "red" : "neutral"} />
        <StatCard href="/review" label="Awaiting review" value={String(summary.awaitingReview)} icon={Hourglass} tone={summary.awaitingReview > 0 ? "amber" : "neutral"} />
        <StatCard href="/staff" label="Staff verified" value={`${summary.staffVerified} of ${summary.staffTotal}`} icon={Users} tone={summary.staffTotal > 0 && summary.staffVerified === summary.staffTotal ? "green" : "neutral"} />
        <StatCard href="/items?view=verified" label="Requirements verified" value={`${summary.readiness.verified} of ${summary.readiness.applicable}`} icon={ClipboardCheck} tone={summary.readiness.applicable > 0 && summary.readiness.verified === summary.readiness.applicable ? "green" : "neutral"} />
        <StatCard href="/safety" label="Open corrective actions" value={String(openActions.count ?? 0)} icon={Wrench} tone={(openActions.count ?? 0) > 0 ? "amber" : "neutral"} />
        <StatCard href="/items?view=unknown" label="Unknown (source not confirmed)" value={String(summary.unknown)} icon={CircleHelp} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Action queue" description="Most pressing first. Safety-critical items lead.">
          {queue.length === 0 ? (
            <Empty>Nothing needs action.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {queue.map(({ r }) => (
                <li key={r.requirement_instance_id} className="flex flex-col gap-1 py-2.5">
                  <Link href={`/items/${r.requirement_instance_id}`} className="text-sm font-medium hover:underline">
                    {r.requirement_title} · {r.subject_label}
                  </Link>
                  <StatusBadge evidence={r.evidence_status!} deadline={r.deadline_status!} />
                  <p className="text-xs text-muted-foreground">
                    Owner: {(r.owner_id && names.get(r.owner_id)) || "Unassigned"} · Next: {nextAction(r.evidence_status!, r.deadline_status!)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/items?view=action" className="mt-2 inline-block text-sm text-primary hover:underline">See everything that needs action</Link>
        </Section>

        <Section title="Upcoming deadlines" description="Next 90 days, requirement items and credentials.">
          {upcoming.length === 0 ? (
            <Empty>No deadlines in the next 90 days.</Empty>
          ) : (
            <Table>
              <tbody>
                {upcoming.map((d) => (
                  <tr key={`${d.kind}-${d.id}`}>
                    <Td>
                      {d.title}
                      <span className="block text-xs text-muted-foreground">{d.subject_label}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {formatDateOnly(d.due_date!)}
                      <span className="block text-xs text-muted-foreground">{DEADLINE_STATUS_LABEL[d.deadline_status!]}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Link href="/calendar" className="mt-2 inline-block text-sm text-primary hover:underline">Open the 30 / 60 / 90 calendar</Link>
        </Section>
      </div>

      <Section title="Program readiness by area" description={READINESS_DISCLAIMER}>
        {usable.length === 0 ? (
          <Empty>No requirements are assigned to you yet. Readiness appears once there are records to compute it from.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Area</Th>
                <Th className="text-right">Readiness</Th>
                <Th className="text-right">Verified</Th>
                <Th className="pr-0 text-right">Unknown</Th>
              </tr>
            </thead>
            <tbody>
              {summary.readinessByArea.map((a) => (
                <tr key={a.area}>
                  <Td className="font-medium">{a.area}</Td>
                  <Td className="text-right tabular-nums">{formatReadiness(a.readiness)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{a.readiness.verified} of {a.readiness.applicable}</Td>
                  <Td className="pr-0 text-right tabular-nums">{a.unknown}</Td>
                </tr>
              ))}
              <tr className="font-semibold">
                <Td>All items</Td>
                <Td className="text-right tabular-nums">{formatReadiness(summary.readiness)}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{summary.readiness.verified} of {summary.readiness.applicable}</Td>
                <Td className="pr-0 text-right tabular-nums">{summary.unknown}</Td>
              </tr>
            </tbody>
          </Table>
        )}
      </Section>

      {session.role === "director" ? (
        <Section title="Recent activity" description="From the audit trail.">
          {(activity.data ?? []).length === 0 ? (
            <Empty>No activity yet.</Empty>
          ) : (
            <ul className="text-sm">
              {(activity.data ?? []).map((a) => (
                <li key={a.id} className="border-b border-border py-1.5 last:border-0">
                  {(a.actor_id && names.get(a.actor_id)) || "System"} {a.action === "INSERT" ? "added a record in" : "changed a record in"}{" "}
                  {a.entity_table.replace(/_/g, " ")}
                  <span className="text-muted-foreground"> · {new Date(a.at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </div>
  );
}

function addDaysIso(days: number): string {
  const [y, m, d] = chicagoToday().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
