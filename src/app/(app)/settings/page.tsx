import type { Metadata } from "next";
import Link from "next/link";
import { saveProgram, saveThresholds, setChildRecords } from "@/actions/settings";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, TextField } from "@/components/forms/fields";
import { PageHeader, Section } from "@/components/tables/Table";
import { can } from "@/lib/auth/permissions";
import { requireRole } from "@/lib/auth/session";
import { getSettings, getThresholds } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireRole("director", "admin_support");
  const db = await createClient();
  const director = can(session.role, "settings.manage");
  const [thresholds, settings, { data: program }] = await Promise.all([
    getThresholds(db),
    getSettings(db),
    db.from("programs").select("*").is("archived_at", null).limit(1).maybeSingle(),
  ]);
  const links = [
    ...(director ? [{ href: "/settings/users", label: "Users, roles and invitations" }, { href: "/settings/setup", label: "Classrooms, credential types, reporting periods and training targets" }, { href: "/settings/auditors", label: "Auditor packets" }] : []),
    { href: "/settings/import", label: "Import staff, credentials or training from CSV" },
    { href: "/settings/notifications", label: "Notifications and delivery log" },
    { href: "/settings/reviews", label: "Quarterly reviews" },
    { href: "/requirements", label: "Requirements library" },
  ];
  return (
    <>
      <PageHeader title="Settings" />
      <Section title="Manage">
        <ul className="flex flex-col gap-2">{links.map((l) => <li key={l.href}><Link className="text-primary hover:underline" href={l.href}>{l.label}</Link></li>)}</ul>
      </Section>
      {director && program ? (
        <>
          <Section title="Program" description="Leave the licensed capacity empty until it is confirmed. It shows as Not confirmed.">
            <ActionForm action={saveProgram} submitLabel="Save program">
              <input type="hidden" name="id" value={program.id} />
              <FormGrid>
                <TextField label="Program name" name="name" required defaultValue={program.name} />
                <TextField label="Licensed capacity" name="licensed_capacity" type="number" min={1} defaultValue={program.licensed_capacity ?? ""} />
                <TextField label="Quality designation" name="quality_designation" defaultValue={program.quality_designation ?? ""} />
                <TextField label="Accreditation" name="accreditation_name" defaultValue={program.accreditation_name ?? ""} />
                <TextField label="Accreditation date" name="accreditation_date" type="date" defaultValue={program.accreditation_date ?? ""} />
              </FormGrid>
            </ActionForm>
          </Section>
          <Section title="Deadline thresholds" description="How many days before a due date an item is shown as due soon and as urgent. These are internal settings, not regulatory rules.">
            <ActionForm action={saveThresholds} submitLabel="Save thresholds">
              <FormGrid>
                <TextField label="Due soon (days before)" name="due_soon_days" type="number" min={1} max={365} required defaultValue={thresholds.dueSoonDays} />
                <TextField label="Urgent (days before)" name="urgent_days" type="number" min={0} max={365} required defaultValue={thresholds.urgentDays} />
              </FormGrid>
            </ActionForm>
          </Section>
          <Section title="Child records" description="Off by default. Turn this on only after the decision to keep child records in this system is approved. Only a code, first name and last initial are stored.">
            <ActionForm action={setChildRecords} submitLabel="Save" confirm="Change whether child records are kept in this system?">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={settings.child_records_enabled === true} /> Keep child file checklists in this system</label>
            </ActionForm>
          </Section>
        </>
      ) : null}
    </>
  );
}
