import type { Metadata } from "next";
import Link from "next/link";
import { createRequirement, generateInstances } from "@/actions/library";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, SelectField, TextField } from "@/components/forms/fields";
import { PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Requirements library" };

const SCOPES = ["staff", "program", "classroom", "child", "facility", "role"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

export default async function RequirementsPage() {
  const session = await requirePermission("overview.read");
  const db = await createClient();
  const [reqs, versions, authorities] = await Promise.all([
    fetchAll((a, b) => db.from("requirements").select("*").is("archived_at", null).order("code").range(a, b)),
    fetchAll((a, b) => db.from("requirement_versions").select("id, requirement_id, status, version_label, last_source_review").range(a, b)),
    fetchAll((a, b) => db.from("authorities").select("id, code, name").order("code").range(a, b)),
  ]);
  const auth = new Map(authorities.map((a) => [a.id, a.code]));
  const director = can(session.role, "library.edit");
  const activeCount = reqs.filter((r) => versions.some((v) => v.requirement_id === r.id && v.status === "active")).length;

  return (
    <>
      <PageHeader title="Requirements library" description={`${activeCount} of ${reqs.length} requirements have a confirmed source. The rest stay unknown and cannot be verified.`} />
      <Section title="Library" description="A requirement becomes active only when a director records its citation, official source link and the date the source was reviewed.">
        <Table>
          <thead><tr><Th>Code</Th><Th>Requirement</Th><Th>Authority</Th><Th>State</Th></tr></thead>
          <tbody>
            {reqs.map((r) => {
              const mine = versions.filter((v) => v.requirement_id === r.id);
              const active = mine.find((v) => v.status === "active");
              const draft = mine.find((v) => v.status === "draft");
              return (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap font-mono text-xs">{r.code}</Td>
                  <Td><Link className="font-medium hover:underline" href={`/requirements/${r.id}`}>{r.title}</Link><span className="block text-xs text-muted-foreground">{r.category ?? ""}</span></Td>
                  <Td>{auth.get(r.authority_id)}</Td>
                  <Td className="space-x-1">
                    {active ? <Badge tone="green">Active {active.version_label}</Badge> : <Badge>Unknown: source not confirmed</Badge>}
                    {draft && active ? <Badge tone="amber">Draft {draft.version_label}</Badge> : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Section>
      {can(session.role, "staff.edit") ? (
        <Section title="Open missing items" description="Opens a checklist item for every person, classroom or program that an active requirement applies to and that does not have one yet. Safe to run again.">
          <ActionForm action={generateInstances} submitLabel="Open missing items" variant="outline" />
        </Section>
      ) : null}
      {director ? (
        <Section title="Add a requirement" description="It is added as a draft. Do not enter a rule from memory: record it from the official source when you activate it.">
          <ActionForm action={createRequirement} submitLabel="Add draft requirement">
            <FormGrid>
              <TextField label="Code" name="code" required placeholder="DHS-STAFF-010" />
              <SelectField label="Authority" name="authority_id" required options={authorities.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))} />
              <SelectField label="Applies to" name="scope" required options={SCOPES} />
              <TextField label="Title" name="title" required maxLength={200} className="sm:col-span-2" />
              <TextField label="Category" name="category" maxLength={80} />
            </FormGrid>
          </ActionForm>
        </Section>
      ) : null}
    </>
  );
}
