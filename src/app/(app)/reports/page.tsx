import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requirePermission("overview.read");
  return (
    <PhasePlaceholder
      title="Reports"
      phase={4}
      summary="Printable reports and CSV exports, quarterly review snapshots and auditor packets."
    />
  );
}
