import Link from "next/link";
import { ItemsTable } from "@/components/tables/ItemsTable";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, profileNames } from "@/lib/data";
import type { Enums } from "@/lib/database.types";
import { formatDateOnly } from "@/lib/dates";
import { summarizeOverview } from "@/lib/domain/overview";
import { formatReadiness, READINESS_DISCLAIMER } from "@/lib/domain/readiness";
import { createClient } from "@/lib/supabase/server";

/** Requirements for one authority, with their approved evidence index. Shared by Licensing, STARS and APPLE. */
export async function AuthorityView({ code, title }: { code: Enums<"authority_code">; title: string }) {
  await requirePermission("overview.read");
  const db = await createClient();
  const [items, evidence, { data: authority }] = await Promise.all([
    fetchAll((a, b) => db.from("v_requirement_status").select("*").eq("authority_code", code).is("closed_at", null).order("requirement_code").order("subject_label").range(a, b)),
    fetchAll((a, b) => db.from("v_review_queue").select("*").eq("authority_code", code).eq("status", "approved").order("requirement_code").range(a, b)),
    db.from("authorities").select("name, website").eq("code", code).maybeSingle(),
  ]);
  const names = await profileNames(db, items.map((i) => i.owner_id));
  const summary = summarizeOverview(items.map((r) => ({ evidenceStatus: r.evidence_status!, deadlineStatus: r.deadline_status!, closedAt: r.closed_at, authorityCode: r.authority_code!, criticality: r.criticality })));

  return (
    <>
      <PageHeader title={title} description={`${authority?.name ?? code} · Readiness ${formatReadiness(summary.readiness)} (${summary.readiness.verified} of ${summary.readiness.applicable} verified, ${summary.unknown} unknown). ${READINESS_DISCLAIMER}`}>
        <Button asChild variant="outline" size="sm"><Link href={`/reports/evidence-index?authority=${code}`}>Evidence index report</Link></Button>
      </PageHeader>
      <Section title="Requirements" description="Items whose source is not confirmed read as unknown until a director activates the requirement in the library.">
        <ItemsTable rows={items} names={names} empty={`No ${code} items are visible to you.`} />
      </Section>
      <Section title="Evidence index" description="Approved evidence on file for these requirements.">
        {evidence.length === 0 ? <Empty>No approved evidence yet.</Empty> : (
          <Table>
            <thead><tr><Th>Requirement</Th><Th>Applies to</Th><Th>Document</Th><Th>Approved</Th><Th>Expires</Th></tr></thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={e.link_id}>
                  <Td>{e.requirement_title}<span className="block text-xs text-muted-foreground">{e.requirement_code}</span></Td>
                  <Td>{e.subject_label}</Td>
                  <Td><a className="text-primary hover:underline" href={`/api/evidence/signed-url?id=${e.evidence_id}`} target="_blank" rel="noreferrer">{e.file_name}</a></Td>
                  <Td className="whitespace-nowrap">{e.reviewed_at ? new Date(e.reviewed_at).toLocaleDateString("en-US", { timeZone: "America/Chicago" }) : "—"}</Td>
                  <Td className="whitespace-nowrap">{e.expiry_date ? formatDateOnly(e.expiry_date) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
