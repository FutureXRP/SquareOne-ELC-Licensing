import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { activateVersion, bulkUpdateInstances, saveDraftVersion, startNewVersion } from "@/actions/library";
import { ActionForm } from "@/components/forms/ActionForm";
import { Field, FormGrid, SelectField, TextField, Textarea } from "@/components/forms/fields";
import { ItemsTable } from "@/components/tables/ItemsTable";
import { PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, listProfiles, personLabel, profileNames } from "@/lib/data";
import { formatDateOnly } from "@/lib/dates";
import { describeRule, parseRecurrenceRule } from "@/lib/domain/deadlines";
import { CRITICALITY_LABEL, FREQUENCY_LABEL, options } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Requirement" };

const SCOPES = ["staff", "program", "classroom", "child", "facility", "role"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

export default async function RequirementPage({ params }: PageProps<"/requirements/[id]">) {
  const session = await requirePermission("overview.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: req } = await db.from("requirements").select("*").eq("id", id).maybeSingle();
  if (!req) notFound();
  const [versions, items] = await Promise.all([
    fetchAll((a, b) => db.from("requirement_versions").select("*").eq("requirement_id", id).order("created_at", { ascending: false }).range(a, b)),
    fetchAll((a, b) => db.from("v_requirement_status").select("*").eq("requirement_id", id).is("closed_at", null).order("subject_label").range(a, b)),
  ]);
  const { data: me } = await db.from("profiles").select("can_draft_library").eq("id", session.userId).maybeSingle();
  const director = can(session.role, "library.edit");
  const drafter = director || (session.role === "admin_support" && me?.can_draft_library === true);
  const office = can(session.role, "staff.edit");
  const draft = versions.find((v) => v.status === "draft");
  const active = versions.find((v) => v.status === "active");
  const names = await profileNames(db, [...items.map((i) => i.owner_id), ...versions.map((v) => v.reviewed_by)]);
  const people = office ? (await listProfiles(db)).filter((p) => p.is_active && p.role !== "auditor").map((p) => ({ value: p.id, label: personLabel(p) })) : [];
  const rule = draft ? (draft.recurrence_rule as Record<string, unknown> | null) : null;
  const roles = draft && typeof draft.applies_to === "object" && draft.applies_to && "roles" in draft.applies_to ? (draft.applies_to.roles as string[]).join(", ") : "";

  return (
    <>
      <PageHeader title={req.title} description={`${req.code}${req.category ? ` · ${req.category}` : ""}`} />

      <Section title="Versions" description="Old versions are kept. Only one version is active at a time.">
        <Table>
          <thead><tr><Th>Version</Th><Th>State</Th><Th>Citation and source</Th><Th>Source reviewed</Th><Th>Rule</Th></tr></thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <Td>{v.version_label}</Td>
                <Td><Badge tone={v.status === "active" ? "green" : v.status === "draft" ? "amber" : "neutral"}>{v.status}</Badge></Td>
                <Td>{v.citation ?? "Not confirmed"}{v.source_url ? <a className="block text-xs text-primary hover:underline" href={v.source_url} target="_blank" rel="noreferrer noopener">Official source</a> : null}</Td>
                <Td className="whitespace-nowrap">{v.last_source_review ? `${formatDateOnly(v.last_source_review)} by ${(v.reviewed_by && names.get(v.reviewed_by)) || "a director"}` : "Never"}</Td>
                <Td>{v.frequency ? FREQUENCY_LABEL[v.frequency] : "Not set"}<span className="block text-xs text-muted-foreground">{describeRule(parseRecurrenceRule(v.recurrence_rule))}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {drafter && !draft ? (
          <div className="mt-3">
            <ActionForm action={startNewVersion} submitLabel="The rule changed: start a new version" variant="outline">
              <input type="hidden" name="requirement_id" value={id} />
            </ActionForm>
          </div>
        ) : null}
      </Section>

      {drafter && draft ? (
        <Section title={`Draft ${draft.version_label}`} description="Fill this in from the official source. Activation needs the citation, the source link, the date you reviewed the source, a frequency and a criticality. When a new version activates, items under the old version close and fresh items open.">
          <ActionForm action={saveDraftVersion} submitLabel="Save draft" variant="outline">
            <input type="hidden" name="version_id" value={draft.id} />
            <FormGrid>
              <TextField label="Citation" name="citation" maxLength={300} defaultValue={draft.citation ?? ""} hint="The rule or standard number, as written in the source." />
              <TextField label="Official source link" name="source_url" type="url" defaultValue={draft.source_url ?? ""} placeholder="https://" />
              <TextField label="Date you reviewed the source" name="last_source_review" type="date" defaultValue={draft.last_source_review ?? ""} />
              <TextField label="Effective date" name="effective_date" type="date" defaultValue={draft.effective_date ?? ""} />
              <SelectField label="Frequency" name="frequency" options={options(FREQUENCY_LABEL)} blank="Not set" defaultValue={draft.frequency ?? ""} />
              <SelectField label="Criticality" name="criticality" options={options(CRITICALITY_LABEL)} blank="Not set" defaultValue={draft.criticality ?? ""} />
              <SelectField label="Applies to" name="scope" options={SCOPES} defaultValue={draft.scope} />
              <TextField label="Only these role titles (optional)" name="applies_to_roles" defaultValue={roles} hint="Comma separated. Empty means everyone in scope." className="sm:col-span-2" />
              <Field label="Description" name="description" className="sm:col-span-2 lg:col-span-3"><Textarea id="description" name="description" defaultValue={draft.description ?? ""} maxLength={2000} /></Field>
              <Field label="What counts as evidence" name="evidence_criteria" className="sm:col-span-2 lg:col-span-3"><Textarea id="evidence_criteria" name="evidence_criteria" defaultValue={draft.evidence_criteria ?? ""} maxLength={2000} /></Field>
            </FormGrid>
            <fieldset className="rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-medium">Recurrence rule (how the next due date is worked out)</legend>
              <FormGrid>
                <SelectField label="Rule" name="rule_type" defaultValue={(rule?.type as string) ?? "none"} options={[
                  { value: "none", label: "No rule (no deadline is generated)" },
                  { value: "interval", label: "Every N days / months / years" },
                  { value: "fixed_months", label: "On fixed months of the year" },
                  { value: "expiration", label: "When the approved document expires" },
                  { value: "event", label: "When an event happens" },
                ]} />
                <TextField label="Interval: every" name="rule_every" type="number" min={1} defaultValue={(rule?.every as number) ?? ""} />
                <SelectField label="Interval: unit" name="rule_unit" defaultValue={(rule?.unit as string) ?? "month"} options={[{ value: "day", label: "Days" }, { value: "month", label: "Months" }, { value: "year", label: "Years" }]} />
                <SelectField label="Interval: counted from" name="rule_anchor" defaultValue={(rule?.anchor as string) ?? "verified_at"} options={[{ value: "verified_at", label: "The date evidence is verified" }, { value: "fixed_date", label: "The previous due date (fixed schedule)" }, { value: "hire_date", label: "The hire date" }]} />
                <TextField label="Fixed months (1-12)" name="rule_months" defaultValue={Array.isArray(rule?.months) ? (rule.months as number[]).join(", ") : ""} placeholder="1, 4, 7, 10" />
                <TextField label="Fixed months: day" name="rule_day" type="number" min={1} max={31} defaultValue={(rule?.day as number) ?? ""} />
                <SelectField label="Event" name="rule_trigger" defaultValue={(rule?.trigger as string) ?? "new_hire"} options={["new_hire", "role_change", "new_child", "inspection", "rule_change"].map((t) => ({ value: t, label: t.replace("_", " ") }))} />
              </FormGrid>
            </fieldset>
          </ActionForm>
          {director ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-sm text-muted-foreground">Save the draft first, then activate. Activation re-sends the saved values below.</p>
            <ActionForm action={activateVersion} submitLabel="Activate this version" confirm="Activate this version? I confirm I reviewed the official source.">
              <input type="hidden" name="version_id" value={draft.id} />
              {(["citation", "source_url", "last_source_review", "effective_date", "frequency", "criticality", "scope", "description", "evidence_criteria"] as const).map((k) => (
                <input key={k} type="hidden" name={k} value={(draft[k] as string | null) ?? ""} />
              ))}
              <input type="hidden" name="applies_to_roles" value={roles} />
              <input type="hidden" name="rule_type" value={(rule?.type as string) ?? "none"} />
              <input type="hidden" name="rule_every" value={String(rule?.every ?? "")} />
              <input type="hidden" name="rule_unit" value={String(rule?.unit ?? "")} />
              <input type="hidden" name="rule_anchor" value={String(rule?.anchor ?? "")} />
              <input type="hidden" name="rule_months" value={Array.isArray(rule?.months) ? (rule.months as number[]).join(",") : ""} />
              <input type="hidden" name="rule_day" value={String(rule?.day ?? "")} />
              <input type="hidden" name="rule_trigger" value={String(rule?.trigger ?? "")} />
            </ActionForm>
          </div>
          ) : <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">Only the director can activate this version.</p>}
        </Section>
      ) : null}

      <Section title="Open items" description="One per person, classroom or program this requirement applies to.">
        <ItemsTable rows={items} names={names} empty="No open items for this requirement." />
        {office && active ? (
          <div className="mt-4 border-t border-border pt-4">
            <ActionForm action={bulkUpdateInstances} submitLabel="Apply to all open items" variant="outline">
              <input type="hidden" name="version_id" value={active.id} />
              <FormGrid>
                <TextField label="Set due date for all" name="due_date" type="date" />
                <SelectField label="Set owner for all" name="owner_id" options={people} blank="Leave as is" />
              </FormGrid>
            </ActionForm>
          </div>
        ) : null}
      </Section>
    </>
  );
}
