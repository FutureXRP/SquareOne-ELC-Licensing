import type { Metadata } from "next";
import { Select } from "@/components/forms/fields";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { listClassrooms } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Classroom indicators" };

/** For classroom reviewers: present or missing, nothing else. The documents are never shown here. */
export default async function ClassroomIndicatorsPage({ searchParams }: PageProps<"/files/classroom">) {
  const session = await requirePermission("overview.read");
  const sp = await searchParams;
  const db = await createClient();
  const all = await listClassrooms(db);
  let allowed = all;
  if (session.role === "classroom_reviewer") {
    const { data } = await db.from("classroom_reviewer_assignments").select("classroom_id").eq("profile_id", session.userId).is("archived_at", null);
    const ids = new Set((data ?? []).map((a) => a.classroom_id));
    allowed = all.filter((c) => ids.has(c.id));
  }
  const selected = allowed.find((c) => c.id === sp.classroom) ?? allowed[0];
  const { data: rows } = selected ? await db.rpc("classroom_file_indicators", { p_classroom: selected.id }) : { data: [] };

  return (
    <>
      <PageHeader title="Classroom file indicators" description="Present or missing for each file item in a classroom. Documents and details stay with the office." />
      <Section title="Classroom">
        {allowed.length === 0 ? <Empty>No classroom is assigned to you.</Empty> : (
          <form className="flex flex-wrap gap-2">
            <Select name="classroom" defaultValue={selected?.id} aria-label="Classroom" className="w-56">{allowed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            <Button type="submit" variant="outline" size="sm">Show</Button>
          </form>
        )}
      </Section>
      {selected ? (
        <Section title={selected.name}>
          {(rows ?? []).length === 0 ? <Empty>No file items for this classroom.</Empty> : (
            <Table>
              <thead><tr><Th>Who</Th><Th>Item</Th><Th>Indicator</Th></tr></thead>
              <tbody>
                {(rows ?? []).map((r, i) => (
                  <tr key={i}><Td>{r.subject_label}<span className="block text-xs text-muted-foreground">{r.subject_type}</span></Td><Td>{r.requirement_title}</Td><Td><Badge tone={r.present ? "green" : "red"}>{r.present ? "Present" : "Missing"}</Badge></Td></tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
      ) : null}
    </>
  );
}
