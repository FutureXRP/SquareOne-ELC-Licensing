import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { requireRole } from "@/lib/auth/session";
import { fetchAll } from "@/lib/data";
import { formatDateOnly, isPast } from "@/lib/dates";
import { READINESS_DISCLAIMER } from "@/lib/domain/readiness";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Packet" };

/** Everything here is read through the auditor's own session: only rows inside a live grant come back. */
export default async function PacketPage({ params }: PageProps<"/packet/[grantId]">) {
  await requireRole("auditor", "director");
  const { grantId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(grantId)) notFound();
  const db = await createClient();
  const { data: grant } = await db.from("auditor_grants").select("*").eq("id", grantId).maybeSingle();
  if (!grant || grant.revoked_at || isPast(grant.expires_at)) notFound();
  const scope = grant.scope as { requirement_ids?: string[]; evidence_ids?: string[] };
  const reqIds = new Set(scope.requirement_ids ?? []);
  const evIds = new Set(scope.evidence_ids ?? []);
  const [items, links] = await Promise.all([
    fetchAll((a, b) => db.from("v_requirement_status").select("*").is("closed_at", null).order("requirement_code").order("subject_label").range(a, b)),
    fetchAll((a, b) => db.from("v_review_queue").select("*").eq("status", "approved").range(a, b)),
  ]);
  const rows = items.filter((i) => reqIds.has(i.requirement_id!));

  return (
    <>
      <PageHeader title={grant.label} description={`Read-only. Access ends ${new Date(grant.expires_at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} (Central time). ${READINESS_DISCLAIMER}`} />
      <Section title="Requirements and approved evidence">
        {rows.length === 0 ? <Empty>Nothing is in this packet.</Empty> : (
          <Table>
            <thead><tr><Th>Requirement</Th><Th>Status</Th><Th>Due</Th><Th>Approved evidence</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.requirement_instance_id}>
                  <Td>{r.requirement_title}<span className="block text-xs text-muted-foreground">{r.requirement_code} · {r.authority_code}</span></Td>
                  <Td><StatusBadge evidence={r.evidence_status!} deadline={r.deadline_status!} /></Td>
                  <Td className="whitespace-nowrap">{r.due_date ? formatDateOnly(r.due_date) : "—"}</Td>
                  <Td>
                    {links.filter((l) => l.requirement_instance_id === r.requirement_instance_id && evIds.has(l.evidence_id!)).map((l) => (
                      <a key={l.link_id} className="block text-primary hover:underline" href={`/api/evidence/signed-url?id=${l.evidence_id}`} target="_blank" rel="noreferrer">{l.file_name}</a>
                    ))}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
