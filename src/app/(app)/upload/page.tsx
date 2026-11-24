import type { Metadata } from "next";
import { EvidenceUploader } from "@/components/evidence/EvidenceUploader";
import { Select } from "@/components/forms/fields";
import { Empty, PageHeader, Section } from "@/components/tables/Table";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, listStaff } from "@/lib/data";
import { uploadClasses } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Upload" };

/** Quick upload: pick whose document it is (office roles), then the file and the requirement it supports. */
export default async function UploadPage({ searchParams }: PageProps<"/upload">) {
  const session = await requirePermission("evidence.upload_own");
  const sp = await searchParams;
  const db = await createClient();
  const office = can(session.role, "staff.read_all");
  const [staff, { data: me }] = await Promise.all([listStaff(db), db.from("profiles").select("child_health_access").eq("id", session.userId).maybeSingle()]);
  const staffId = office && typeof sp.staff === "string" ? sp.staff : (session.staffId ?? (office ? staff[0]?.id : undefined));
  const person = staff.find((s) => s.id === staffId);
  const items = staffId
    ? await fetchAll((a, b) => db.from("v_requirement_status").select("requirement_instance_id, requirement_title, requirement_code").eq("subject_id", staffId).is("closed_at", null).range(a, b))
    : [];

  return (
    <>
      <PageHeader title="Upload a document" description="Uploading puts a document in the review queue. It does not complete a requirement." />
      {office ? (
        <Section title="Whose document is it?">
          <form className="flex flex-wrap items-center gap-2">
            <Select name="staff" defaultValue={staffId ?? ""} aria-label="Staff member" className="w-64">
              {staff.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.employee_code})</option>)}
            </Select>
            <Button type="submit" variant="outline" size="sm">Choose</Button>
          </form>
        </Section>
      ) : null}
      <Section title={person ? `Document for ${person.first_name} ${person.last_name}` : "Document"}>
        {staffId && person ? (
          <EvidenceUploader
            key={staffId}
            subjectType="staff"
            subjectId={staffId}
            instances={items.map((i) => ({ value: i.requirement_instance_id!, label: `${i.requirement_title} (${i.requirement_code})` }))}
            accessClasses={uploadClasses(session.role, me?.child_health_access ?? false)}
          />
        ) : (
          <Empty>Your login is not linked to a staff record yet. Ask the director to link it in Settings.</Empty>
        )}
      </Section>
    </>
  );
}
