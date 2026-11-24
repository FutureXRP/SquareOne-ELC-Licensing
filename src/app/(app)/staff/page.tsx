import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  await requirePermission("overview.read");
  return (
    <PhasePlaceholder
      title="Staff"
      phase={2}
      summary="Staff list and profiles: credentials, training ledger, file checklist and tasks for each person."
    />
  );
}
