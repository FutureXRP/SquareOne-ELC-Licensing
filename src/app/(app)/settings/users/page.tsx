import type { Metadata } from "next";
import { assignReviewerClassroom, inviteUser, updateUser } from "@/actions/users";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, Select, SelectField, TextField } from "@/components/forms/fields";
import { PageHeader, Section } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { requireRole } from "@/lib/auth/session";
import { fetchAll, listClassrooms, listProfiles, listStaff, personLabel } from "@/lib/data";
import { options } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requireRole("director");
  const db = await createClient();
  const [profiles, staff, classrooms, assignments] = await Promise.all([
    listProfiles(db),
    listStaff(db),
    listClassrooms(db),
    fetchAll((a, b) => db.from("classroom_reviewer_assignments").select("profile_id, classroom_id").is("archived_at", null).range(a, b)),
  ]);
  const staffOptions = staff.filter((s) => s.employment_status !== "separated").map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name} (${s.employee_code})` }));
  const room = new Map(classrooms.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title="Users and roles" description="Accounts are by invitation only. A person can see nothing until their account is active and has a role." />
      <Section title="Invite someone" description="Leave the temporary password empty to send an email invitation. Fill it in to create the account right away and share the password privately (useful before email is set up).">
        <ActionForm action={inviteUser} submitLabel="Invite">
          <FormGrid>
            <TextField label="Email" name="email" type="email" required />
            <TextField label="Display name" name="display_name" maxLength={120} />
            <SelectField label="Role" name="role" required options={options(ROLE_LABEL)} defaultValue="educator" />
            <SelectField label="Staff record" name="staff_id" options={staffOptions} blank="Not linked" hint="Link educators to their own staff record." />
            <TextField label="Temporary password (optional)" name="temporary_password" type="text" minLength={12} autoComplete="off" hint="At least 12 characters." />
          </FormGrid>
        </ActionForm>
      </Section>
      <Section title={`Accounts (${profiles.length})`}>
        <div className="flex flex-col gap-4">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-medium">
                {personLabel(p)} <span className="font-normal text-muted-foreground">{p.email}</span>{" "}
                <Badge tone={p.is_active ? "green" : "neutral"}>{p.is_active ? "Active" : "Inactive"}</Badge>
              </p>
              <ActionForm action={updateUser} submitLabel="Save" variant="outline" size="sm">
                <input type="hidden" name="id" value={p.id} />
                <FormGrid>
                  <TextField label="Display name" name="display_name" defaultValue={p.display_name ?? ""} />
                  <SelectField label="Role" name="role" options={options(ROLE_LABEL)} defaultValue={p.role} />
                  <SelectField label="Staff record" name="staff_id" options={staffOptions} blank="Not linked" defaultValue={p.staff_id ?? ""} />
                </FormGrid>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={p.is_active} /> Active (can sign in and see data)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="child_health_access" defaultChecked={p.child_health_access} /> May see child health files (admin support only)</label>
                </div>
              </ActionForm>
              {p.role === "classroom_reviewer" ? (
                <div className="mt-3 border-t border-border pt-3 text-sm">
                  <p className="mb-2">Classrooms: {assignments.filter((a) => a.profile_id === p.id).map((a) => room.get(a.classroom_id)).join(", ") || "none assigned"}</p>
                  <ActionForm action={assignReviewerClassroom} submitLabel="Assign classroom" variant="outline" size="sm" inline>
                    <input type="hidden" name="profile_id" value={p.id} />
                    <Select name="classroom_id" aria-label="Classroom" className="h-8 w-48 py-0">{classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                  </ActionForm>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
