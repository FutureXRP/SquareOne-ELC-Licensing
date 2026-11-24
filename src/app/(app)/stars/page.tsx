import type { Metadata } from "next";
import { AuthorityView } from "@/components/tables/AuthorityView";

export const metadata: Metadata = { title: "STARS" };

export default function StarsPage() {
  return <AuthorityView code="STARS" title="STARS" />;
}
