import type { Metadata } from "next";
import { addClassroom, addCredentialType, addReportingPeriod, renameClassroom, saveAuthority, savePdlTarget, saveTrainingTarget, setCredentialTypeCritical } from "@/actions/settings";
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
  const [classrooms, types, periods, targets, staff, authorities, pdlTargets] = await Promise.all([
    listClassrooms(db),
    fetchAll((a, b) => db.from("credential_types").select("*").is("archived_at", null).order("name").range(a, b)),
    fetchAll((a, b) => db.from("reporting_periods").select("*").is("archived_at", null).order("start_date", { ascending: false }).range(a, b)),
    fetchAll((a, b) => db.from("training_targets").select("*").is("archived_at", null).range(a, b)),
    listStaff(db),
    fetchAll((a, b) => db.from("authorities").select("*").order("code").range(a, b)),
    fetchAll((a, b) => db.from("pdl_hour_targets").select("*").is("archived_at", null).order("level_min").range(a, b)),
  ]);
  const roles = [...new Set(staff.map((s) => s.role_title).filter((r): r is string => !!r))].sort();
  const periodLabel = new Map(periods.map((p) => [p.id, p.label]));

  return (
    <>
      <PageHeader title="Setup" description="Classrooms, credential types, reporting periods and training targets." />
      <Section title="Authorities" description="Replace the working labels with each authority's official name and website before activating its requirements.">
        <div className="flex flex-col gap-3">
          {authorities.map((a) => (
            <ActionForm key={a.id} action={saveAuthority} submitLabel="Save" variant="outline" size="sm" inline>
              <input type="hidden" name="id" value={a.id} />
              <span className="w-20 font-mono text-xs">{a.code}</span>
              <Input name="name" defaultValue={a.name} aria-label={`${a.code} official name`} className="h-8 w-72" required />
              <Input name="website" type="url" defaultValue={a.website ?? ""} aria-label={`${a.code} website`} placeholder="https://" className="h-8 w-64" />
            </ActionForm>
          ))}
        </div>
      </Section>
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
        <Table><thead><tr><Th>Name</Th><Th>Category</Th><Th>Needs an expiration date</Th><Th>Critical (120-day and 1-day notices, daily when overdue)</Th></tr></thead>
          <tbody>{types.map((t) => (
            <tr key={t.id}><Td>{t.name}</Td><Td>{t.category ?? "—"}</Td><Td>{t.requires_expiration ? "Yes" : "No"}</Td>
              <Td><ActionForm action={setCredentialTypeCritical} submitLabel="Save" variant="outline" size="sm" inline>
                <input type="hidden" name="id" value={t.id} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_critical" defaultChecked={t.is_critical} /> Critical</label>
              </ActionForm></Td>
            </tr>))}</tbody>
        </Table>
        <div className="mt-4 border-t border-border pt-4">
          <ActionForm action={addCredentialType} submitLabel="Add credential type">
            <FormGrid>
              <TextField label="Name" name="name" required maxLength={120} />
              <TextField label="Category" name="category" maxLength={80} />
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="requires_expiration" /> Needs an expiration date</label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="is_critical" /> Critical</label>
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
      <Section title="CECPD / PDL renewal hours by level" description="Enter these from the current CECPD publication. A row is used only after you tick confirmed, which needs the official source link and the date you reviewed it. Saving the same level range again replaces it.">
        {pdlTargets.length === 0 ? <Empty>No PDL targets entered. Until one is confirmed, the training screen shows the requirement as not confirmed.</Empty> : (
          <Table><thead><tr><Th>Levels</Th><Th>Renewal hours</Th><Th>Source</Th><Th>Reviewed</Th><Th>Confirmed</Th></tr></thead>
            <tbody>{pdlTargets.map((t) => (
              <tr key={t.id}><Td>{t.level_min === t.level_max ? t.level_min : `${t.level_min} to ${t.level_max}`}</Td><Td>{formatMinutes(t.target_minutes)}</Td>
                <Td>{t.source_url ? <a className="text-primary hover:underline" href={t.source_url} target="_blank" rel="noreferrer noopener">Official source</a> : "—"}</Td>
                <Td>{t.last_source_review ? formatDateOnly(t.last_source_review) : "—"}</Td><Td>{t.confirmed ? "Yes" : "No"}</Td></tr>))}</tbody>
          </Table>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <ActionForm action={savePdlTarget} submitLabel="Save PDL target">
            <FormGrid>
              <TextField label="From level" name="level_min" type="number" min={1} max={11} required />
              <TextField label="To level" name="level_max" type="number" min={1} max={11} required />
              <TextField label="Renewal hours" name="hours" type="number" min={0} max={500} step="0.25" required />
              <TextField label="Official source link" name="source_url" type="url" placeholder="https://" />
              <TextField label="Date you reviewed the source" name="last_source_review" type="date" />
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="confirmed" /> Confirmed against the official source</label>
            </FormGrid>
          </ActionForm>
        </div>
      </Section>
    </>
  );
}
