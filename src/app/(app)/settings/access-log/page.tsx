import type { Metadata } from "next";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { requireRole } from "@/lib/auth/session";
import { fetchAll, profileNames } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Document view log" };

export default async function AccessLogPage() {
  await requireRole("director");
  const db = await createClient();
  const log = await fetchAll((a, b) => db.from("evidence_access_log").select("*").order("at", { ascending: false }).range(a, Math.min(b, a + 299)));
  const ids = [...new Set(log.map((l) => l.evidence_id))];
  const [names, { data: files }] = await Promise.all([
    profileNames(db, log.map((l) => l.profile_id)),
    ids.length > 0 ? db.from("evidence").select("id, file_name, doc_type, access_class").in("id", ids) : Promise.resolve({ data: [] }),
  ]);
  const file = new Map((files ?? []).map((f) => [f.id, f]));
  return (
    <>
      <PageHeader title="Document view log" description="Every time someone opens a stored document, the person, document and time are recorded. This log cannot be edited or deleted." />
      <Section title="Most recent 300 views">
        {log.length === 0 ? <Empty>No documents have been opened yet.</Empty> : (
          <Table>
            <thead><tr><Th>When (Central time)</Th><Th>Who</Th><Th>Document</Th><Th>Access class</Th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap">{new Date(l.at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}</Td>
                  <Td>{names.get(l.profile_id) ?? "—"}</Td>
                  <Td>{file.get(l.evidence_id)?.file_name ?? "—"}<span className="block text-xs text-muted-foreground">{file.get(l.evidence_id)?.doc_type ?? ""}</span></Td>
                  <Td>{file.get(l.evidence_id)?.access_class.replace("_", " ") ?? ""}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
