import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Staff files" };

export default async function FilesStaffPage() {
  await requirePermission("overview.read");
  return (
    <PhasePlaceholder
      title="Staff files"
      phase={3}
      summary="Staff file checklists. Child file checklists follow once the director approves keeping child records in this system."
    />
  );
}
