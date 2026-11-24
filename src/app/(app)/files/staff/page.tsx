import type { Metadata } from "next";
import Link from "next/link";
import { FileGrid } from "@/components/tables/FileGrid";
import { PageHeader, Section } from "@/components/tables/Table";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff files" };

export default async function StaffFilesPage() {
  await requirePermission("overview.read");
  const db = await createClient();
  const rows = await fetchAll((a, b) => db.from("v_requirement_status").select("*").eq("subject_type", "staff").is("closed_at", null).range(a, b));
  return (
    <>
      <PageHeader title="Staff files" description="File checklist by person. Each cell is the computed status of one requirement.">
        <Link className="text-sm text-primary hover:underline" href="/files/children">Child files</Link>
        <Link className="text-sm text-primary hover:underline" href="/files/classroom">Classroom indicators</Link>
      </PageHeader>
      <Section title="Checklist">
        <FileGrid rows={rows} empty="No staff file items are visible to you." />
      </Section>
    </>
  );
}
