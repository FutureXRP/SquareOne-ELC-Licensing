import type { Metadata } from "next";
import { addClassroom, addCredentialType, addReportingPeriod, renameClassroom, saveTrainingTarget } from "@/actions/settings";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, SelectField, TextField } from "@/components/forms/fields";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth/session";
import { fetchAll, listClassrooms, listStaff } from "@/lib/data";
import { formatDateOnly } from "@/lib/dates";
import { formatMinutes } from "@/lib/domain/training";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Setup" };

export default async function SetupPage() {
  await requireRole("director");
  const db = await createClient();
  const [classrooms, types, periods, targets, staff] = await Promise.all([
    listClassrooms(db),
    fetchAll((a, b) => db.from("credential_types").select("*").is("archived_at", null).order("name").range(a, b)),
    fetchAll((a, b) => db.from("reporting_periods").select("*").is("archived_at", null).order("start_date", { ascending: false }).range(a, b)),
    fetchAll((a, b) => db.from("training_targets").select("*").is("archived_at", null).range(a, b)),
    listStaff(db),
  ]);
  const roles = [...new Set(staff.map((s) => s.role_title).filter((r): r is string => !!r))].sort();
  const periodLabel = new Map(periods.map((p) => [p.id, p.label]));

  return (
    <>
      <PageHeader title="Setup" description="Classrooms, credential types, reporting periods and training targets." />
      <Section title="Classrooms">
        <div className="flex flex-col gap-2">
          {classrooms.map((c) => (
            <ActionForm key={c.id} action={renameClassroom} submitLabel="Rename" variant="outline" size="sm" inline>
              <input type="hidden" name="id" value={c.id} />
              <Input name="name" defaultValue={c.name} aria-label="Classroom name" className="h-8 w-56" required />
            </ActionForm>
          ))}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <ActionForm action={addClassroom} submitLabel="Add classroom" inline><Input name="name" placeholder="New classroom name" aria-label="New classroom name" className="h-10 w-56" required /></ActionForm>
        </div>
      </Section>
      <Section title="Credential types">
        <Table><thead><tr><Th>Name</Th><Th>Category</Th><Th>Needs an expiration date</Th></tr></thead>
          <tbody>{types.map((t) => <tr key={t.id}><Td>{t.name}</Td><Td>{t.category ?? "—"}</Td><Td>{t.requires_expiration ? "Yes" : "No"}</Td></tr>)}</tbody>
        </Table>
        <div className="mt-4 border-t border-border pt-4">
          <ActionForm action={addCredentialType} submitLabel="Add credential type">
            <FormGrid>
              <TextField label="Name" name="name" required maxLength={120} />
              <TextField label="Category" name="category" maxLength={80} />
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="requires_expiration" /> Needs an expiration date</label>
            </FormGrid>
          </ActionForm>
        </div>
      </Section>
      <Section title="Reporting periods" description="The most recent period is the one the training screens use.">
        {periods.length === 0 ? <Empty>No reporting periods.</Empty> : (
          <Table><thead><tr><Th>Label</Th><Th>Starts</Th><Th>Ends</Th></tr></thead>
            <tbody>{periods.map((p) => <tr key={p.id}><Td>{p.label}</Td><Td>{formatDateOnly(p.start_date)}</Td><Td>{formatDateOnly(p.end_date)}</Td></tr>)}</tbody>
          </Table>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <ActionForm action={addReportingPeriod} submitLabel="Add reporting period">
            <FormGrid><TextField label="Label" name="label" required maxLength={80} /><TextField label="Start" name="start_date" type="date" required /><TextField label="End" name="end_date" type="date" required /></FormGrid>
          </ActionForm>
        </div>
      </Section>
      <Section title="Training targets" description="Hours per role and reporting period. A target stays labeled as an internal, unconfirmed target until you tick confirmed.">
        {targets.length === 0 ? <Empty>No targets.</Empty> : (
          <Table><thead><tr><Th>Role</Th><Th>Period</Th><Th>Target</Th><Th>Confirmed</Th></tr></thead>
            <tbody>{targets.map((t) => <tr key={t.id}><Td>{t.role_title}</Td><Td>{periodLabel.get(t.reporting_period_id) ?? "—"}</Td><Td>{formatMinutes(t.target_minutes)}</Td><Td>{t.confirmed ? "Yes" : "No (internal target)"}</Td></tr>)}</tbody>
          </Table>
        )}
        {periods.length > 0 ? (
          <div className="mt-4 border-t border-border pt-4">
            <ActionForm action={saveTrainingTarget} submitLabel="Save target">
              <FormGrid>
                <TextField label="Role title" name="role_title" required list="role-titles" maxLength={80} />
                <SelectField label="Reporting period" name="reporting_period_id" options={periods.map((p) => ({ value: p.id, label: p.label }))} />
                <TextField label="Target hours" name="hours" type="number" min={0} max={500} step="0.25" required />
                <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="confirmed" /> Confirmed against the official requirement</label>
              </FormGrid>
              <datalist id="role-titles">{roles.map((r) => <option key={r} value={r} />)}</datalist>
            </ActionForm>
          </div>
        ) : null}
      </Section>
    </>
  );
}
