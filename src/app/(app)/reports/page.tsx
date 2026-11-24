import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/tables/Table";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { REPORT_TYPES } from "@/lib/reports";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const session = await requirePermission("overview.read");
  const office = can(session.role, "staff.read_all");
  const links: { href: string; label: string }[] = [
    { href: "/reports/director-action", label: REPORT_TYPES["director-action"] },
    { href: "/reports/credential-matrix", label: REPORT_TYPES["credential-matrix"] },
    { href: "/reports/training", label: REPORT_TYPES.training },
    { href: "/reports/evidence-index?authority=DHS", label: "DHS evidence index" },
    { href: "/reports/evidence-index?authority=STARS", label: "STARS evidence index" },
    { href: "/reports/evidence-index?authority=APPLE", label: "APPLE evidence index" },
    { href: "/reports/file-audit", label: REPORT_TYPES["file-audit"] },
    { href: "/reports/inspections", label: REPORT_TYPES.inspections },
    { href: "/reports/renewal-calendar", label: REPORT_TYPES["renewal-calendar"] },
  ];
  return (
    <>
      <PageHeader title="Reports" description="Each report shows when it was generated, the filters used and how to read the verification status. Reports contain only what your role can see." />
      <Section title="Reports">
        <ul className="grid gap-2 sm:grid-cols-2">
          {links.map((l) => <li key={l.href}><Link className="text-primary hover:underline" href={l.href}>{l.label}</Link></li>)}
        </ul>
      </Section>
      {office ? (
        <Section title="Quarterly reviews and auditor packets">
          <ul className="flex flex-col gap-2">
            <li><Link className="text-primary hover:underline" href="/settings/reviews">Quarterly review cycles and signed snapshots</Link></li>
            {can(session.role, "settings.manage") ? <li><Link className="text-primary hover:underline" href="/settings/auditors">Auditor packets (scoped, time-limited access)</Link></li> : null}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
