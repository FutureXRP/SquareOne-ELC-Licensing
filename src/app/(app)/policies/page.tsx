import type { Metadata } from "next";
import { acknowledgePolicy, addPolicyVersion, createPolicy } from "@/actions/program";
import { ActionForm } from "@/components/forms/ActionForm";
import { Field, FormGrid, TextField, Textarea } from "@/components/forms/fields";
import { Empty, PageHeader, Section } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll } from "@/lib/data";
import { formatDateOnly } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Policies" };

export default async function PoliciesPage() {
  const session = await requirePermission("overview.read");
  const db = await createClient();
  const [policies, versions, acks, { count: people }] = await Promise.all([
    fetchAll((a, b) => db.from("policies").select("*").is("archived_at", null).order("title").range(a, b)),
    fetchAll((a, b) => db.from("policy_versions").select("*").order("created_at", { ascending: false }).range(a, b)),
    fetchAll((a, b) => db.from("policy_acknowledgments").select("policy_version_id, profile_id, acknowledged_at").range(a, b)),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true).neq("role", "auditor"),
  ]);
  const director = can(session.role, "settings.manage");
  const office = can(session.role, "staff.read_all");

  return (
    <>
      <PageHeader title="Policies" description="Current policies and who has acknowledged them. A new version needs a new acknowledgment." />
      {policies.length === 0 ? <Section title="Policies"><Empty>No policies published yet.</Empty></Section> : null}
      {policies.map((p) => {
        const mine = versions.filter((v) => v.policy_id === p.id);
        const active = mine.find((v) => v.status === "active");
        const signed = active ? acks.filter((a) => a.policy_version_id === active.id) : [];
        const iSigned = signed.some((a) => a.profile_id === session.userId);
        return (
          <Section key={p.id} title={p.title} description={`${p.category ?? "Policy"}${active ? ` · ${active.version_label}${active.effective_date ? `, effective ${formatDateOnly(active.effective_date)}` : ""}` : ""}`}>
            {active ? (
              <>
                <p className="whitespace-pre-wrap text-sm">{active.summary ?? "No summary."}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {iSigned ? <Badge tone="green">You acknowledged this version</Badge> : (
                    <ActionForm action={acknowledgePolicy} submitLabel="I have read and acknowledge this policy" inline>
                      <input type="hidden" name="policy_version_id" value={active.id} />
                    </ActionForm>
                  )}
                  {office ? <span className="text-sm text-muted-foreground">{signed.length} of {people ?? 0} people have acknowledged</span> : null}
                </div>
              </>
            ) : <Empty>No active version.</Empty>}
            {director ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-primary">Publish a new version ({mine.length} so far)</summary>
                <div className="mt-2">
                  <ActionForm action={addPolicyVersion} submitLabel="Publish new version" confirm="Publish a new version? Everyone will need to acknowledge it again.">
                    <input type="hidden" name="policy_id" value={p.id} />
                    <Field label="Policy text or summary" name="summary"><Textarea id="summary" name="summary" required maxLength={4000} defaultValue={active?.summary ?? ""} /></Field>
                    <TextField label="Effective date" name="effective_date" type="date" />
                  </ActionForm>
                </div>
              </details>
            ) : null}
          </Section>
        );
      })}
      {director ? (
        <Section title="Publish a policy">
          <ActionForm action={createPolicy} submitLabel="Publish policy">
            <FormGrid>
              <TextField label="Title" name="title" required maxLength={160} />
              <TextField label="Category" name="category" maxLength={80} />
              <TextField label="Effective date" name="effective_date" type="date" />
            </FormGrid>
            <Field label="Policy text or summary" name="summary"><Textarea id="summary" name="summary" maxLength={4000} /></Field>
          </ActionForm>
        </Section>
      ) : null}
    </>
  );
}
