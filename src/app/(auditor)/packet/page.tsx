import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageHeader, Section } from "@/components/tables/Table";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Packets" };

export default async function PacketsPage() {
  await requireRole("auditor", "director");
  const db = await createClient();
  const { data: grants } = await db.from("auditor_grants").select("id, label, expires_at, revoked_at").is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("expires_at");
  return (
    <>
      <PageHeader title="Your packets" description="Read-only access granted by the director for a limited time." />
      <Section title="Live packets">
        {(grants ?? []).length === 0 ? <Empty>You have no live packets. Ask the director to grant one.</Empty> : (
          <ul className="flex flex-col gap-2">
            {(grants ?? []).map((g) => (
              <li key={g.id}><Link className="text-primary hover:underline" href={`/packet/${g.id}`}>{g.label}</Link> <span className="text-sm text-muted-foreground">until {new Date(g.expires_at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}</span></li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
