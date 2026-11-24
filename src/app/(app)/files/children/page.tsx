import type { Metadata } from "next";
import Link from "next/link";
import { addChild } from "@/actions/program";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, SelectField, TextField } from "@/components/forms/fields";
import { FileGrid } from "@/components/tables/FileGrid";
import { Empty, PageHeader, Section } from "@/components/tables/Table";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, getSettings, listClassrooms } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Child files" };

export default async function ChildFilesPage() {
  const session = await requirePermission("overview.read");
  const db = await createClient();
  const [settings, rows, classrooms] = await Promise.all([
    getSettings(db),
    fetchAll((a, b) => db.from("v_requirement_status").select("*").eq("subject_type", "child").is("closed_at", null).range(a, b)),
    listClassrooms(db),
  ]);
  const enabled = settings.child_records_enabled === true;
  return (
    <>
      <PageHeader title="Child files" description="Checklist indicators only: a code, first name and last initial. No health details are stored in this list.">
        <Link className="text-sm text-primary hover:underline" href="/files/staff">Staff files</Link>
        {enabled && can(session.role, "staff.edit") ? <Button asChild size="sm" variant="outline"><a href={`/api/export/${"child-files"}`}>Export CSV</a></Button> : null}
      </PageHeader>
      {!enabled ? (
        <Section title="Child records are off">
          <Empty>Whether child records are kept in this system is an open decision. A director can turn them on in Settings once it is approved.</Empty>
        </Section>
      ) : (
        <>
          <Section title="Checklist"><FileGrid rows={rows} empty="No child file items yet. They open when a child is added and a child-scope requirement is active." /></Section>
          {can(session.role, "staff.edit") ? (
            <Section title="Add a child">
              <ActionForm action={addChild} submitLabel="Add child">
                <FormGrid>
                  <TextField label="Child code" name="child_code" required maxLength={40} />
                  <TextField label="First name" name="first_name" required maxLength={60} />
                  <TextField label="Last initial" name="last_initial" required maxLength={1} />
                  <SelectField label="Classroom" name="classroom_id" options={classrooms.map((c) => ({ value: c.id, label: c.name }))} blank="None" />
                  <TextField label="Enrollment date" name="enrollment_date" type="date" />
                </FormGrid>
              </ActionForm>
            </Section>
          ) : null}
        </>
      )}
    </>
  );
}
