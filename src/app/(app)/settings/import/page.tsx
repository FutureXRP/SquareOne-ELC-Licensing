import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/tables/Table";
import { requireRole } from "@/lib/auth/session";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  await requireRole("director", "admin_support");
  return (
    <>
      <PageHeader title="Import from CSV" description="Preview first. Rows with errors and rows already on file are skipped, never overwritten. Imported credentials and training start unverified." />
      <Section title="Import"><ImportForm /></Section>
    </>
  );
}
