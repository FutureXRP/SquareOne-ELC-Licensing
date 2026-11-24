import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Licensing" };

export default async function LicensingPage() {
  await requirePermission("overview.read");
  return (
    <PhasePlaceholder
      title="Licensing"
      phase={3}
      summary="DHS licensing requirements with their evidence index. Requirements stay unknown until a director confirms each source."
    />
  );
}
