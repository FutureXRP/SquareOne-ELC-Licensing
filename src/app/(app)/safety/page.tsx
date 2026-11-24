import type { Metadata } from "next";
import { addFinding, addInspection, addSafetyCheck, closeCorrectiveAction } from "@/actions/program";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, SelectField, TextField } from "@/components/forms/fields";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, listClassrooms, listProfiles, personLabel, profileNames } from "@/lib/data";
import { chicagoToday, formatDateOnly } from "@/lib/dates";
import { CRITICALITY_LABEL, options } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Safety" };

const CHECKS = [{ value: "weekly_checklist", label: "Weekly safety checklist" }, { value: "drill", label: "Emergency drill" }, { value: "maintenance", label: "Maintenance" }, { value: "inspection", label: "Internal inspection" }];

export default async function SafetyPage() {
  const session = await requirePermission("overview.read");
  const db = await createClient();
  const office = can(session.role, "staff.edit");
  const [classrooms, checks, inspections, findings, actions, authorities, profiles] = await Promise.all([
    listClassrooms(db),
    fetchAll((a, b) => db.from("safety_checks").select("*").is("archived_at", null).order("performed_on", { ascending: false }).range(a, b)),
    office ? fetchAll((a, b) => db.from("inspections").select("*").is("archived_at", null).order("inspection_date", { ascending: false }).range(a, b)) : Promise.resolve([]),
    office ? fetchAll((a, b) => db.from("findings").select("*").is("archived_at", null).range(a, b)) : Promise.resolve([]),
    fetchAll((a, b) => db.from("corrective_actions").select("*").is("archived_at", null).order("due_date", { nullsFirst: false }).range(a, b)),
    fetchAll((a, b) => db.from("authorities").select("id, code").order("code").range(a, b)),
    office ? listProfiles(db) : Promise.resolve([]),
  ]);
  const names = await profileNames(db, [...checks.map((c) => c.performed_by), ...actions.map((a) => a.owner_id), ...actions.map((a) => a.verified_by)]);
  const room = new Map(classrooms.map((c) => [c.id, c.name]));
  const auth = new Map(authorities.map((a) => [a.id, a.code]));
  const people = profiles.filter((p) => p.is_active && p.role !== "auditor").map((p) => ({ value: p.id, label: personLabel(p) }));
  const today = chicagoToday();
  const openActions = actions.filter((a) => !a.verified_at);

  return (
    <>
      <PageHeader title="Safety" description="Safety checks, drills, inspections, findings and corrective actions." />
      <Section title="Record a check or drill">
        <ActionForm action={addSafetyCheck} submitLabel="Record">
          <FormGrid>
            <SelectField label="Type" name="check_type" options={CHECKS} required />
            <SelectField label="Classroom" name="classroom_id" options={classrooms.map((c) => ({ value: c.id, label: c.name }))} blank={office ? "Whole facility" : "Choose"} required={!office} />
            <TextField label="Date" name="performed_on" type="date" required defaultValue={today} max={today} />
            <SelectField label="Result" name="result" options={[{ value: "pass", label: "No issues" }, { value: "issue_found", label: "Issue found" }]} required />
            <TextField label="Notes" name="notes" maxLength={1000} className="sm:col-span-2" hint="Required when an issue was found. No child names or health details." />
          </FormGrid>
        </ActionForm>
      </Section>

      <Section title="Recent checks and drills">
        {checks.length === 0 ? <Empty>No checks recorded.</Empty> : (
          <Table>
            <thead><tr><Th>Date</Th><Th>Type</Th><Th>Where</Th><Th>Result</Th><Th>By</Th></tr></thead>
            <tbody>
              {checks.slice(0, 40).map((c) => (
                <tr key={c.id}>
                  <Td className="whitespace-nowrap">{formatDateOnly(c.performed_on)}</Td>
                  <Td>{CHECKS.find((k) => k.value === c.check_type)?.label}</Td>
                  <Td>{(c.classroom_id && room.get(c.classroom_id)) || "Facility"}</Td>
                  <Td><Badge tone={c.result === "pass" ? "green" : "red"}>{c.result === "pass" ? "No issues" : "Issue found"}</Badge>{c.notes ? <span className="mt-1 block text-xs">{c.notes}</span> : null}</Td>
                  <Td>{names.get(c.performed_by) ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title="Corrective actions" description="An action is closed only when a director verifies the closure.">
        {actions.length === 0 ? <Empty>No corrective actions.</Empty> : (
          <Table>
            <thead><tr><Th>Action</Th><Th>Owner</Th><Th>Due</Th><Th>State</Th></tr></thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <Td>{a.description}<span className="block text-xs text-muted-foreground">Finding: {findings.find((f) => f.id === a.finding_id)?.description ?? "—"}</span></Td>
                  <Td>{(a.owner_id && names.get(a.owner_id)) || "Unassigned"}</Td>
                  <Td className="whitespace-nowrap">{a.due_date ? formatDateOnly(a.due_date) : "—"}</Td>
                  <Td>
                    {a.verified_at ? <Badge tone="green">Closed, verified by {(a.verified_by && names.get(a.verified_by)) || "director"}</Badge> : (
                      <>
                        <Badge tone={a.due_date && a.due_date < today ? "red" : "amber"}>{a.due_date && a.due_date < today ? "Overdue" : "Open"}</Badge>
                        {can(session.role, "evidence.review") ? (
                          <ActionForm action={closeCorrectiveAction} submitLabel="Verify closure" size="sm" variant="outline" inline className="mt-1" confirm="Confirm this corrective action is complete?">
                            <input type="hidden" name="id" value={a.id} />
                          </ActionForm>
                        ) : null}
                      </>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{openActions.length} open.</p>
      </Section>

      {office ? (
        <>
          <Section title="Inspections">
            {inspections.length === 0 ? <Empty>No inspections recorded.</Empty> : (
              <div className="flex flex-col gap-4">
                {inspections.map((i) => (
                  <div key={i.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{formatDateOnly(i.inspection_date)} · {auth.get(i.authority_id)} · {i.kind}{i.inspector ? ` · ${i.inspector}` : ""}</p>
                    {i.summary ? <p className="mt-1 text-sm">{i.summary}</p> : null}
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {findings.filter((f) => f.inspection_id === i.id).map((f) => <li key={f.id}>{f.description}{f.criticality ? ` (${CRITICALITY_LABEL[f.criticality]})` : ""}</li>)}
                    </ul>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-primary">Add a finding and its corrective action</summary>
                      <div className="mt-2">
                        <ActionForm action={addFinding} submitLabel="Add finding">
                          <input type="hidden" name="inspection_id" value={i.id} />
                          <FormGrid>
                            <TextField label="Finding" name="description" required maxLength={1000} className="sm:col-span-2" />
                            <SelectField label="Criticality" name="criticality" options={options(CRITICALITY_LABEL)} blank="Not set" />
                            <TextField label="Corrective action" name="action" required maxLength={1000} className="sm:col-span-2" />
                            <SelectField label="Owner" name="owner_id" options={people} blank="Unassigned" />
                            <TextField label="Due date" name="due_date" type="date" />
                          </FormGrid>
                        </ActionForm>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section title="Record an inspection">
            <ActionForm action={addInspection} submitLabel="Record inspection">
              <FormGrid>
                <SelectField label="Authority" name="authority_id" required options={authorities.map((a) => ({ value: a.id, label: a.code }))} />
                <TextField label="Date" name="inspection_date" type="date" required max={today} />
                <TextField label="Kind" name="kind" required defaultValue="routine" maxLength={60} />
                <TextField label="Inspector" name="inspector" maxLength={120} />
                <TextField label="Summary" name="summary" maxLength={2000} className="sm:col-span-2" />
              </FormGrid>
            </ActionForm>
          </Section>
        </>
      ) : null}
    </>
  );
}
