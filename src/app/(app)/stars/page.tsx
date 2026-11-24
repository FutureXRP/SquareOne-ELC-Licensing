import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "STARS" };

export default async function StarsPage() {
  await requirePermission("overview.read");
  return (
    <PhasePlaceholder
      title="STARS"
      phase={3}
      summary="STARS requirements with their evidence index. Requirements stay unknown until a director confirms each source."
    />
  );
}
