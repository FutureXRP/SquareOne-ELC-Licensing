import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { approveNotApplicable, updateInstance } from "@/actions/library";
import { EvidenceUploader } from "@/components/evidence/EvidenceUploader";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, SelectField, TextField } from "@/components/forms/fields";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { listProfiles, personLabel, profileNames } from "@/lib/data";
import { formatDateOnly } from "@/lib/dates";
import { describeRule, parseRecurrenceRule } from "@/lib/domain/deadlines";
import { nextAction } from "@/lib/domain/overview";
import { uploadClasses } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Item" };

export default async function ItemPage({ params }: PageProps<"/items/[id]">) {
  const session = await requirePermission("overview.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: item } = await db.from("v_requirement_status").select("*").eq("requirement_instance_id", id).maybeSingle();
  if (!item) notFound();
  const [{ data: version }, { data: links }, { data: raw }, { data: me }] = await Promise.all([
    db.from("requirement_versions").select("description, evidence_criteria, citation, source_url, version_label").eq("id", item.requirement_version_id!).maybeSingle(),
    db.from("v_review_queue").select("*").eq("requirement_instance_id", id).order("submitted_at", { ascending: false }),
    db.from("requirement_instances").select("na_reason, na_approved_by, previous_instance_id").eq("id", id).maybeSingle(),
    db.from("profiles").select("child_health_access").eq("id", session.userId).maybeSingle(),
  ]);
  const office = can(session.role, "staff.edit");
  const profiles = office ? await listProfiles(db) : [];
  const names = await profileNames(db, [item.owner_id, item.backup_id]);
  const people = profiles.filter((p) => p.is_active && p.role !== "auditor").map((p) => ({ value: p.id, label: personLabel(p) }));
  const open = item.closed_at === null;

  return (
    <>
      <PageHeader title={item.requirement_title ?? "Item"} description={`${item.requirement_code} · ${item.authority_code} · ${item.subject_label ?? ""}${(item.cycle_number ?? 1) > 1 ? ` · cycle ${item.cycle_number}` : ""}`} />
      <Section title="Status">
        <div className="flex flex-col gap-2 text-sm">
          <StatusBadge evidence={item.evidence_status!} deadline={item.deadline_status!} />
          {!open ? <Badge>Closed cycle (history)</Badge> : null}
          <p>Due: {item.due_date ? formatDateOnly(item.due_date) : "No deadline"} · Owner: {(item.owner_id && names.get(item.owner_id)) || "Unassigned"} · Backup: {(item.backup_id && names.get(item.backup_id)) || "None"}</p>
          {open ? <p>Next step: {nextAction(item.evidence_status!, item.deadline_status!)}</p> : null}
          {raw?.na_approved_by ? <p>Not applicable: {raw.na_reason}</p> : null}
          {raw?.previous_instance_id ? <Link className="text-primary hover:underline" href={`/items/${raw.previous_instance_id}`}>Previous cycle and its evidence</Link> : null}
        </div>
      </Section>

      <Section title="Requirement">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Version</dt><dd>{version?.version_label} ({item.version_status})</dd></div>
          <div><dt className="text-muted-foreground">Recurrence</dt><dd>{describeRule(parseRecurrenceRule(item.recurrence_rule))}</dd></div>
          <div><dt className="text-muted-foreground">Citation</dt><dd>{version?.citation ?? "Not confirmed"}</dd></div>
          <div><dt className="text-muted-foreground">Source</dt><dd>{version?.source_url ? <a className="text-primary hover:underline" href={version.source_url} rel="noreferrer noopener" target="_blank">Official source</a> : "Not confirmed"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">What counts as evidence</dt><dd>{version?.evidence_criteria ?? "Not written yet"}</dd></div>
        </dl>
        {item.version_status !== "active" ? (
          <p className="mt-3 rounded-md bg-status-neutral-bg px-3 py-2 text-sm">
            This requirement&apos;s source is not confirmed, so it reads as unknown and evidence cannot be approved against it yet.
          </p>
        ) : null}
      </Section>

      <Section title="Evidence" description="Each submission is reviewed separately. Earlier decisions stay on record.">
        {(links ?? []).length === 0 ? <Empty>No evidence submitted.</Empty> : (
          <Table>
            <thead><tr><Th>Document</Th><Th>Submitted</Th><Th>Decision</Th><Th>Expires</Th></tr></thead>
            <tbody>
              {(links ?? []).map((l) => (
                <tr key={l.link_id}>
                  <Td><a className="text-primary hover:underline" href={`/api/evidence/signed-url?id=${l.evidence_id}`} target="_blank" rel="noreferrer">{l.file_name}</a><span className="block text-xs text-muted-foreground">{l.doc_type}</span></Td>
                  <Td className="whitespace-nowrap">{new Date(l.submitted_at!).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}</Td>
                  <Td>
                    <Badge tone={l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "amber"}>{l.status === "pending" ? "Awaiting review" : l.status}</Badge>
                    {l.correction_note ? <span className="mt-1 block text-xs">Correction: {l.correction_note}</span> : null}
                  </Td>
                  <Td className="whitespace-nowrap">{l.expiry_date ? formatDateOnly(l.expiry_date) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {open && item.subject_id && session.role ? (
        <Section title="Upload evidence">
          <EvidenceUploader subjectType={item.subject_type!} subjectId={item.subject_id} instanceId={id} accessClasses={uploadClasses(session.role, me?.child_health_access ?? false)} />
        </Section>
      ) : null}

      {office && open ? (
        <Section title="Assignment" description="A due date can only be set once the requirement is active.">
          <ActionForm action={updateInstance} submitLabel="Save">
            <input type="hidden" name="id" value={id} />
            <FormGrid>
              <TextField label="Due date" name="due_date" type="date" defaultValue={item.due_date ?? ""} />
              <SelectField label="Owner" name="owner_id" options={people} blank="Unassigned" defaultValue={item.owner_id ?? ""} />
              <SelectField label="Backup" name="backup_id" options={people} blank="None" defaultValue={item.backup_id ?? ""} />
            </FormGrid>
          </ActionForm>
        </Section>
      ) : null}

      {can(session.role, "na.approve") && open && !raw?.na_approved_by ? (
        <Section title="Not applicable" description="Removes this item from readiness. A reason is required and the approval is recorded in your name.">
          <ActionForm action={approveNotApplicable} submitLabel="Approve as not applicable" variant="outline" confirm="Mark this item as not applicable?">
            <input type="hidden" name="id" value={id} />
            <TextField label="Reason" name="na_reason" required maxLength={500} />
          </ActionForm>
        </Section>
      ) : null}
    </>
  );
}
