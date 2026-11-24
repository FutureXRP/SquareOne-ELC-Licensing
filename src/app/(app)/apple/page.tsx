import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "APPLE" };

export default async function ApplePage() {
  await requirePermission("overview.read");
  return (
    <PhasePlaceholder
      title="APPLE"
      phase={3}
      summary="APPLE accreditation requirements with their evidence index. No deadlines are generated until renewal and reporting dates are confirmed."
    />
  );
}
