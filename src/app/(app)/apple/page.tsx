import type { Metadata } from "next";
import { AuthorityView } from "@/components/tables/AuthorityView";

export const metadata: Metadata = { title: "APPLE" };

export default function ApplePage() {
  return <AuthorityView code="APPLE" title="APPLE" />;
}
