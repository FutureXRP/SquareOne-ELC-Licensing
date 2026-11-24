import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, listStaff } from "@/lib/data";
import { formatDateOnly } from "@/lib/dates";
import { formatMinutes, inWindow, pdlRenewalYear, pdlTargetMinutes, summarizeTraining } from "@/lib/domain/training";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Training" };

export default async function TrainingPage() {
  await requirePermission("overview.read");
  const db = await createClient();
  const [staff, records, periods, targets, pdlTargets] = await Promise.all([
    listStaff(db),
    fetchAll((a, b) => db.from("training_records").select("staff_id, minutes, state, completion_date, reporting_period_id").is("archived_at", null).range(a, b)),
    fetchAll((a, b) => db.from("reporting_periods").select("*").is("archived_at", null).order("start_date", { ascending: false }).range(a, b)),
    fetchAll((a, b) => db.from("training_targets").select("*").is("archived_at", null).range(a, b)),
    fetchAll((a, b) => db.from("pdl_hour_targets").select("*").is("archived_at", null).range(a, b)),
  ]);
  const period = periods[0] ?? null;
  const active = staff.filter((s) => s.employment_status !== "separated");

  return (
    <>
      <PageHeader title="Training" description={period ? `Reporting period: ${period.label}. Only verified training counts toward the target.` : "No reporting period is set up. Add one in Settings."} />
      <Section title="Hours by person">
        {active.length === 0 ? <Empty>No staff records are visible to you.</Empty> : (
          <Table>
            <thead><tr><Th>Name</Th><Th className="text-right">Verified</Th><Th className="text-right">Pending</Th><Th className="text-right">Target</Th><Th className="text-right">Remaining</Th></tr></thead>
            <tbody>
              {active.map((s) => {
                const rows = records.filter((r) => r.staff_id === s.id && (!period || r.reporting_period_id === period.id || (r.completion_date >= period.start_date && r.completion_date <= period.end_date)));
                const target = period ? targets.find((t) => t.reporting_period_id === period.id && t.role_title === s.role_title) : undefined;
                const sum = summarizeTraining(rows, target?.target_minutes ?? null);
                return (
                  <tr key={s.id}>
                    <Td><Link className="font-medium hover:underline" href={`/staff/${s.id}`}>{s.first_name} {s.last_name}</Link><span className="block text-xs text-muted-foreground">{s.role_title ?? ""}</span></Td>
                    <Td className="text-right tabular-nums">{formatMinutes(sum.verifiedMinutes)}</Td>
                    <Td className="text-right tabular-nums">{formatMinutes(sum.pendingMinutes)}</Td>
                    <Td className="text-right tabular-nums">{sum.targetMinutes === null ? "Not set" : formatMinutes(sum.targetMinutes)}{target && !target.confirmed ? <span className="block text-xs text-muted-foreground">Internal target, unconfirmed</span> : null}</Td>
                    <Td className="text-right tabular-nums">{sum.remainingMinutes === null ? "—" : sum.remainingMinutes === 0 ? <Badge tone="green">Met</Badge> : formatMinutes(sum.remainingMinutes)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Section>
      <Section title="CECPD / PDL renewal hours" description="Counted over each person's own renewal year (the 12 months ending on their PDL renewal date), separately from the internal target above. A requirement shows only once the director has confirmed it from the official source.">
        {active.length === 0 ? <Empty>No staff records are visible to you.</Empty> : (
          <Table>
            <thead><tr><Th>Name</Th><Th>PDL level</Th><Th>Renewal year</Th><Th className="text-right">Verified</Th><Th className="text-right">Required</Th><Th className="text-right">Remaining</Th></tr></thead>
            <tbody>
              {active.map((s) => {
                if (!s.pdl_renewal_date) {
                  return <tr key={s.id}><Td>{s.first_name} {s.last_name}</Td><Td>{s.pdl_level ?? "—"}</Td><Td colSpan={4} className="text-muted-foreground">No PDL renewal date on the staff record.</Td></tr>;
                }
                const window = pdlRenewalYear(s.pdl_renewal_date);
                const sum = summarizeTraining(records.filter((r) => r.staff_id === s.id && inWindow(r.completion_date, window)), pdlTargetMinutes(s.pdl_level, pdlTargets));
                return (
                  <tr key={s.id}>
                    <Td><Link className="font-medium hover:underline" href={`/staff/${s.id}`}>{s.first_name} {s.last_name}</Link></Td>
                    <Td>{s.pdl_level ?? "—"}</Td>
                    <Td className="whitespace-nowrap">{formatDateOnly(window.start)} to {formatDateOnly(window.end)}</Td>
                    <Td className="text-right tabular-nums">{formatMinutes(sum.verifiedMinutes)}</Td>
                    <Td className="text-right tabular-nums">{sum.targetMinutes === null ? "Not confirmed" : formatMinutes(sum.targetMinutes)}</Td>
                    <Td className="text-right tabular-nums">{sum.remainingMinutes === null ? "—" : sum.remainingMinutes === 0 ? <Badge tone="green">Met</Badge> : formatMinutes(sum.remainingMinutes)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
