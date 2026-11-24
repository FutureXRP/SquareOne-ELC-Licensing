import type { Metadata } from "next";
import { createAuditorGrant, revokeAuditorGrant } from "@/actions/program";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, SelectField, TextField } from "@/components/forms/fields";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/session";
import { fetchAll, listProfiles, personLabel } from "@/lib/data";
import { isPast } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Auditor packets" };

export default async function AuditorsPage() {
  await requireRole("director");
  const db = await createClient();
  const [grants, profiles] = await Promise.all([
    fetchAll((a, b) => db.from("auditor_grants").select("*").order("created_at", { ascending: false }).range(a, b)),
    listProfiles(db),
  ]);
  const auditors = profiles.filter((p) => p.role === "auditor" && p.is_active);
  const label = new Map(profiles.map((p) => [p.id, personLabel(p)]));

  return (
    <>
      <PageHeader title="Auditor packets" description="Inspection mode. An auditor sees one authority's requirements and the evidence already approved for them, read-only, until the packet expires or you revoke it." />
      <Section title="Grant a packet">
        {auditors.length === 0 ? <Empty>Invite someone with the Auditor role first (Settings, Users).</Empty> : (
          <ActionForm action={createAuditorGrant} submitLabel="Grant packet" confirm="Give this auditor read-only access to the approved evidence for this authority?">
            <FormGrid>
              <SelectField label="Auditor" name="profile_id" required options={auditors.map((a) => ({ value: a.id, label: personLabel(a) }))} />
              <SelectField label="Authority" name="authority" required options={["DHS", "STARS", "APPLE", "CECPD", "INTERNAL"].map((a) => ({ value: a, label: a }))} />
              <TextField label="Label" name="label" required maxLength={120} placeholder="Licensing visit" />
              <TextField label="Days of access" name="days" type="number" min={1} max={30} required defaultValue={3} />
            </FormGrid>
          </ActionForm>
        )}
      </Section>
      <Section title="Packets">
        {grants.length === 0 ? <Empty>No packets granted.</Empty> : (
          <Table>
            <thead><tr><Th>Packet</Th><Th>Auditor</Th><Th>Expires</Th><Th>State</Th></tr></thead>
            <tbody>
              {grants.map((g) => {
                const live = !g.revoked_at && !isPast(g.expires_at);
                return (
                  <tr key={g.id}>
                    <Td>{g.label}</Td>
                    <Td>{label.get(g.profile_id) ?? "—"}</Td>
                    <Td className="whitespace-nowrap">{new Date(g.expires_at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}</Td>
                    <Td>
                      <Badge tone={live ? "green" : "neutral"}>{g.revoked_at ? "Revoked" : live ? "Live" : "Expired"}</Badge>
                      {live ? <ActionForm action={revokeAuditorGrant} submitLabel="Revoke" size="sm" variant="outline" inline className="ml-2"><input type="hidden" name="id" value={g.id} /></ActionForm> : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
