import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/layout/PrintButton";
import { Empty, PageHeader, Table, Td, Th } from "@/components/tables/Table";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { chicagoToday, formatDateOnly } from "@/lib/dates";
import { READINESS_DISCLAIMER } from "@/lib/domain/readiness";
import { buildReport, isReportType } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({ params, searchParams }: PageProps<"/reports/[type]">) {
  const session = await requirePermission("overview.read");
  const { type } = await params;
  const sp = await searchParams;
  if (!isReportType(type)) notFound();
  const authority = typeof sp.authority === "string" ? sp.authority : undefined;
  const report = await buildReport(await createClient(), type, { authority });
  const query = authority ? `?authority=${encodeURIComponent(authority)}` : "";

  return (
    <>
      <PageHeader title={report.title}>
        <PrintButton />
        <Button asChild variant="outline" size="sm"><a href={`/api/export/${type}${query}`}>Download CSV</a></Button>
      </PageHeader>
      <div className="mb-4 rounded-md border border-border bg-card p-3 text-sm">
        <p>Generated {formatDateOnly(chicagoToday())} (Central time) by {session.displayName ?? session.email}.</p>
        <p>Filters: {report.filters}. {report.rows.length} rows.</p>
        <p>{report.note}</p>
        <p className="font-medium">{READINESS_DISCLAIMER}</p>
      </div>
      {report.rows.length === 0 ? <Empty>No rows.</Empty> : (
        <Table className="bg-card">
          <thead><tr>{report.columns.map((c) => <Th key={c} className="px-2">{c}</Th>)}</tr></thead>
          <tbody>{report.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <Td key={j} className="px-2">{c}</Td>)}</tr>)}</tbody>
        </Table>
      )}
    </>
  );
}
