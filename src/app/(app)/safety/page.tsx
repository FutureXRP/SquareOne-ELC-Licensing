import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Safety" };

export default async function SafetyPage() {
  await requirePermission("overview.read");
  return (
    <PhasePlaceholder
      title="Safety"
      phase={3}
      summary="Safety checks, drills, inspections, findings and corrective actions with verified closure."
    />
  );
}
