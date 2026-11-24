import type { Metadata } from "next";
import Link from "next/link";
import { createStaff } from "@/actions/staff";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, SelectField, TextField } from "@/components/forms/fields";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, listClassrooms, listStaff } from "@/lib/data";
import { isGreen } from "@/lib/domain/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const session = await requirePermission("overview.read");
  const db = await createClient();
  const [staff, classrooms, items, creds] = await Promise.all([
    listStaff(db),
    listClassrooms(db),
    fetchAll((a, b) => db.from("v_requirement_status").select("subject_id, evidence_status, deadline_status").eq("subject_type", "staff").is("closed_at", null).range(a, b)),
    fetchAll((a, b) => db.from("v_credentials").select("staff_id, deadline_status, is_verified_current, is_latest").range(a, b)),
  ]);
  const room = new Map(classrooms.map((c) => [c.id, c.name]));
  const edit = can(session.role, "staff.edit");

  return (
    <>
      <PageHeader title="Staff" description={edit ? "Everyone on the roster, with where their file stands." : "Your staff record."} />
      <Section title="Roster">
        {staff.length === 0 ? <Empty>No staff records are visible to you.</Empty> : (
          <Table>
            <thead><tr><Th>Name</Th><Th>Role</Th><Th>Classroom</Th><Th>File items</Th><Th>Credentials</Th></tr></thead>
            <tbody>
              {staff.map((s) => {
                const mine = items.filter((i) => i.subject_id === s.id && i.evidence_status !== "not_applicable");
                const green = mine.filter((i) => isGreen(i.evidence_status!, i.deadline_status!)).length;
                const c = creds.filter((x) => x.staff_id === s.id && x.is_latest);
                const expired = c.filter((x) => x.deadline_status === "overdue").length;
                const soon = c.filter((x) => x.deadline_status === "urgent" || x.deadline_status === "due_soon").length;
                return (
                  <tr key={s.id}>
                    <Td>
                      <Link className="font-medium hover:underline" href={`/staff/${s.id}`}>{s.first_name} {s.last_name}</Link>
                      <span className="block text-xs text-muted-foreground">{s.employee_code}{s.employment_status !== "active" ? ` · ${s.employment_status.replace("_", " ")}` : ""}</span>
                    </Td>
                    <Td>{s.role_title ?? "—"}</Td>
                    <Td>{(s.classroom_id && room.get(s.classroom_id)) || "—"}</Td>
                    <Td><Badge tone={mine.length > 0 && green === mine.length ? "green" : "neutral"}>{green} of {mine.length} verified</Badge></Td>
                    <Td className="space-x-1">
                      {expired > 0 ? <Badge tone="red">{expired} expired</Badge> : null}
                      {soon > 0 ? <Badge tone="amber">{soon} due soon</Badge> : null}
                      {expired === 0 && soon === 0 ? <span className="text-muted-foreground">{c.length} on file</span> : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Section>
      {edit ? (
        <Section title="Add a staff member" description="Their file checklist opens automatically from the active requirements.">
          <ActionForm action={createStaff} submitLabel="Add staff member">
            <FormGrid>
              <TextField label="Employee code" name="employee_code" required maxLength={40} />
              <TextField label="First name" name="first_name" required maxLength={80} />
              <TextField label="Last name" name="last_name" required maxLength={80} />
              <TextField label="Role title" name="role_title" maxLength={80} />
              <SelectField label="Classroom" name="classroom_id" options={classrooms.map((c) => ({ value: c.id, label: c.name }))} blank="None" />
              <TextField label="Hire date" name="hire_date" type="date" />
            </FormGrid>
          </ActionForm>
        </Section>
      ) : null}
    </>
  );
}
