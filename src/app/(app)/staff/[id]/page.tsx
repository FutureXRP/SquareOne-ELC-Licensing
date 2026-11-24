import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { addCredential, addTraining, reviewTraining, updateStaff, verifyCredential } from "@/actions/staff";
import { EvidenceUploader } from "@/components/evidence/EvidenceUploader";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, Select, SelectField, TextField } from "@/components/forms/fields";
import { ItemsTable } from "@/components/tables/ItemsTable";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, listClassrooms, listProfiles, personLabel } from "@/lib/data";
import { formatDateOnly } from "@/lib/dates";
import { DEADLINE_STATUS_LABEL } from "@/lib/domain/status";
import { formatMinutes, summarizeTraining } from "@/lib/domain/training";
import { uploadClasses } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff profile" };

export default async function StaffProfilePage({ params }: PageProps<"/staff/[id]">) {
  const session = await requirePermission("overview.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: person } = await db.from("staff").select("*").eq("id", id).maybeSingle();
  if (!person) notFound();
  const edit = can(session.role, "staff.edit");
  const review = can(session.role, "evidence.review");
  const [items, creds, training, types, periods, targets, classrooms, profiles, { data: me }] = await Promise.all([
    fetchAll((a, b) => db.from("v_requirement_status").select("*").eq("subject_id", id).is("closed_at", null).order("requirement_code").range(a, b)),
    fetchAll((a, b) => db.from("v_credentials").select("*").eq("staff_id", id).order("expiration_date", { nullsFirst: false }).range(a, b)),
    fetchAll((a, b) => db.from("training_records").select("*").eq("staff_id", id).is("archived_at", null).order("completion_date", { ascending: false }).range(a, b)),
    fetchAll((a, b) => db.from("credential_types").select("id, name").is("archived_at", null).order("name").range(a, b)),
    fetchAll((a, b) => db.from("reporting_periods").select("*").is("archived_at", null).order("start_date", { ascending: false }).range(a, b)),
    fetchAll((a, b) => db.from("training_targets").select("*").is("archived_at", null).range(a, b)),
    listClassrooms(db),
    edit ? listProfiles(db) : Promise.resolve([]),
    db.from("profiles").select("child_health_access").eq("id", session.userId).maybeSingle(),
  ]);
  const period = periods[0] ?? null;
  const target = period ? targets.find((t) => t.reporting_period_id === period.id && t.role_title === person.role_title) : undefined;
  const inPeriod = period ? training.filter((t) => t.reporting_period_id === period.id || (t.completion_date >= period.start_date && t.completion_date <= period.end_date)) : training;
  const summary = summarizeTraining(inPeriod, target?.target_minutes ?? null);
  const people = profiles.filter((p) => p.is_active).map((p) => ({ value: p.id, label: personLabel(p) }));

  return (
    <>
      <PageHeader title={`${person.first_name} ${person.last_name}`} description={`${person.employee_code} · ${person.role_title ?? "No role title"} · ${person.employment_status.replace("_", " ")}${person.hire_date ? ` · hired ${formatDateOnly(person.hire_date)}` : ""}`} />

      <Section title="File checklist" description="Each requirement that applies to this person.">
        <ItemsTable rows={items} showSubject={false} empty="No requirements apply to this person yet." />
      </Section>

      <Section title="Credentials" description="The expiration date is the real one printed on the credential. A credential counts as verified only after a director has seen it, and never once it has expired.">
        {creds.length === 0 ? <Empty>No credentials on file.</Empty> : (
          <Table>
            <thead><tr><Th>Credential</Th><Th>Issued</Th><Th>Expires</Th><Th>Standing</Th>{review ? <Th>Review</Th> : null}</tr></thead>
            <tbody>
              {creds.map((c) => (
                <tr key={c.id}>
                  <Td>{c.credential_name}<span className="block text-xs text-muted-foreground">{c.issuer ?? ""}{c.eligibility_status ? ` · eligibility: ${c.eligibility_status}` : ""}</span></Td>
                  <Td className="whitespace-nowrap">{c.issue_date ? formatDateOnly(c.issue_date) : "—"}</Td>
                  <Td className="whitespace-nowrap">{c.expiration_date ? formatDateOnly(c.expiration_date) : "No expiry"}</Td>
                  <Td className="space-x-1">
                    {c.deadline_status === "overdue" ? <Badge tone="red">Expired</Badge> : c.is_verified_current ? <Badge tone={c.deadline_status === "current" || c.deadline_status === "none" ? "green" : "neutral"}>Verified</Badge> : <Badge tone="amber">Unverified</Badge>}
                    {c.deadline_status === "urgent" || c.deadline_status === "due_soon" ? <Badge tone={c.deadline_status === "urgent" ? "red" : "amber"}>{DEADLINE_STATUS_LABEL[c.deadline_status]}</Badge> : null}
                  </Td>
                  {review ? (
                    <Td>
                      {c.verified_at ? <span className="text-xs text-muted-foreground">Verified {new Date(c.verified_at).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}</span> : (
                        <ActionForm action={verifyCredential} submitLabel="Verify" size="sm" variant="outline" inline>
                          <input type="hidden" name="id" value={c.id!} />
                          {c.eligibility_status ? (
                            <Select name="eligibility_status" defaultValue="eligible" aria-label="Eligibility" className="h-8 w-28 py-0">
                              <option value="eligible">Eligible</option><option value="ineligible">Ineligible</option><option value="pending">Pending</option>
                            </Select>
                          ) : null}
                        </ActionForm>
                      )}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {edit ? (
          <div className="mt-4 border-t border-border pt-4">
            <ActionForm action={addCredential} submitLabel="Record credential">
              <input type="hidden" name="staff_id" value={id} />
              <FormGrid>
                <SelectField label="Credential type" name="credential_type_id" required options={types.map((t) => ({ value: t.id, label: t.name }))} />
                <TextField label="Issuer" name="issuer" maxLength={120} />
                <TextField label="Issue date" name="issue_date" type="date" />
                <TextField label="Expiration date" name="expiration_date" type="date" />
                <TextField label="Internal review date" name="internal_review_date" type="date" hint="Separate from the real expiration." />
                <SelectField label="Renewal owner" name="renewal_owner_id" options={people} blank="The staff member" />
              </FormGrid>
            </ActionForm>
          </div>
        ) : null}
      </Section>

      <Section title="Training ledger" description={period ? `Reporting period: ${period.label}` : "No reporting period is set up yet."}>
        <p className="mb-3 text-sm">
          Verified: <strong>{formatMinutes(summary.verifiedMinutes)}</strong> · Pending review: {formatMinutes(summary.pendingMinutes)} ·{" "}
          {summary.targetMinutes === null ? "No target set for this role" : <>Remaining: <strong>{formatMinutes(summary.remainingMinutes ?? 0)}</strong> of {formatMinutes(summary.targetMinutes)} {target?.confirmed ? "" : "(internal target, unconfirmed)"}</>}
        </p>
        {training.length === 0 ? <Empty>No training recorded.</Empty> : (
          <Table>
            <thead><tr><Th>Course</Th><Th>Completed</Th><Th className="text-right">Length</Th><Th>State</Th>{review ? <Th>Review</Th> : null}</tr></thead>
            <tbody>
              {training.map((t) => (
                <tr key={t.id}>
                  <Td>{t.course_title}<span className="block text-xs text-muted-foreground">{[t.provider, t.category, t.certificate_identifier].filter(Boolean).join(" · ")}</span></Td>
                  <Td className="whitespace-nowrap">{formatDateOnly(t.completion_date)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatMinutes(t.minutes)}</Td>
                  <Td><Badge tone={t.state === "verified" ? "green" : t.state === "pending" ? "amber" : "neutral"}>{t.state}</Badge></Td>
                  {review ? (
                    <Td>{t.state === "pending" ? (
                      <ActionForm action={reviewTraining} submitLabel="Save" size="sm" variant="outline" inline>
                        <input type="hidden" name="id" value={t.id} />
                        <Select name="state" defaultValue="verified" aria-label="Decision" className="h-8 w-28 py-0"><option value="verified">Verify</option><option value="ineligible">Ineligible</option></Select>
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="registry_verified" /> In registry</label>
                      </ActionForm>
                    ) : null}</Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {person.employment_status !== "separated" ? (
          <div className="mt-4 border-t border-border pt-4">
            <ActionForm action={addTraining} submitLabel="Record training">
              <input type="hidden" name="staff_id" value={id} />
              {period ? <input type="hidden" name="reporting_period_id" value={period.id} /> : null}
              <FormGrid>
                <TextField label="Course title" name="course_title" required maxLength={200} />
                <TextField label="Provider" name="provider" maxLength={120} />
                <TextField label="Completion date" name="completion_date" type="date" required />
                <TextField label="Hours" name="hours" type="number" min={0} max={100} defaultValue={0} />
                <TextField label="Minutes" name="minutes" type="number" min={0} max={59} defaultValue={0} />
                <TextField label="Certificate number" name="certificate_identifier" maxLength={120} />
              </FormGrid>
            </ActionForm>
          </div>
        ) : null}
      </Section>

      {session.role && person.employment_status !== "separated" ? (
        <Section title="Upload a document for this file">
          <EvidenceUploader subjectType="staff" subjectId={id} instances={items.map((i) => ({ value: i.requirement_instance_id!, label: `${i.requirement_title} (${i.requirement_code})` }))} accessClasses={uploadClasses(session.role, me?.child_health_access ?? false)} />
        </Section>
      ) : null}

      {edit ? (
        <Section title="Staff record" description="Setting the status to separated turns off their login and cancels their open tasks and reminders. Their records are kept.">
          <ActionForm action={updateStaff} submitLabel="Save record">
            <input type="hidden" name="id" value={id} />
            <FormGrid>
              <TextField label="Employee code" name="employee_code" required defaultValue={person.employee_code} />
              <TextField label="First name" name="first_name" required defaultValue={person.first_name} />
              <TextField label="Last name" name="last_name" required defaultValue={person.last_name} />
              <TextField label="Role title" name="role_title" defaultValue={person.role_title ?? ""} />
              <SelectField label="Classroom" name="classroom_id" options={classrooms.map((c) => ({ value: c.id, label: c.name }))} blank="None" defaultValue={person.classroom_id ?? ""} />
              <TextField label="Hire date" name="hire_date" type="date" defaultValue={person.hire_date ?? ""} />
              <SelectField label="Employment status" name="employment_status" defaultValue={person.employment_status} options={[{ value: "active", label: "Active" }, { value: "on_leave", label: "On leave" }, { value: "separated", label: "Separated" }]} />
              <TextField label="Separation date" name="separation_date" type="date" defaultValue={person.separation_date ?? ""} />
              <TextField label="PDL level (1-11)" name="pdl_level" type="number" min={1} max={11} defaultValue={person.pdl_level ?? ""} hint="From the person's CECPD record." />
              <TextField label="PDL renewal date" name="pdl_renewal_date" type="date" defaultValue={person.pdl_renewal_date ?? ""} hint="Renewal hours are counted over the 12 months ending on this date." />
            </FormGrid>
          </ActionForm>
        </Section>
      ) : null}
    </>
  );
}
