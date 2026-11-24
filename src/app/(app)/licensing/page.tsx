import type { Metadata } from "next";
import { AuthorityView } from "@/components/tables/AuthorityView";

export const metadata: Metadata = { title: "Licensing" };

export default function LicensingPage() {
  return <AuthorityView code="DHS" title="Licensing" />;
}
