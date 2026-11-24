import type { Metadata } from "next";
import Link from "next/link";
import { Select } from "@/components/forms/fields";
import { ItemsTable } from "@/components/tables/ItemsTable";
import { PageHeader, Section } from "@/components/tables/Table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, listClassrooms, profileNames } from "@/lib/data";
import { actionRank } from "@/lib/domain/overview";
import { DEADLINE_STATUS_LABEL, EVIDENCE_STATUS_LABEL, isGreen } from "@/lib/domain/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Items" };

const VIEWS: Record<string, string> = {
  action: "Needs action",
  overdue: "Overdue",
  due: "Due in 30 days",
  missing: "Missing evidence",
  verified: "Verified",
  unknown: "Unknown (source not confirmed)",
  safety: "Safety-critical exceptions",
};

export default async function ItemsPage({ searchParams }: PageProps<"/items">) {
  await requirePermission("overview.read");
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [view, authority, status, deadline, classroom, owner, q] = ["view", "authority", "status", "deadline", "classroom", "owner", "q"].map(get);
  const db = await createClient();
  const [all, classrooms] = await Promise.all([
    fetchAll((a, b) => db.from("v_requirement_status").select("*").is("closed_at", null).order("due_date", { nullsFirst: false }).order("requirement_instance_id").range(a, b)),
    listClassrooms(db),
  ]);
  const names = await profileNames(db, all.map((r) => r.owner_id));
  const needle = q.toLowerCase();

  const rows = all.filter((r) => {
    const e = r.evidence_status!;
    const d = r.deadline_status!;
    if (view === "overdue" && d !== "overdue") return false;
    if (view === "due" && d !== "due_soon" && d !== "urgent") return false;
    if (view === "missing" && e !== "missing" && e !== "needs_correction") return false;
    if (view === "verified" && e !== "verified") return false;
    if (view === "unknown" && e !== "unknown") return false;
    if (view === "action" && actionRank({ evidenceStatus: e, deadlineStatus: d, criticality: r.criticality }) === null) return false;
    if (view === "safety" && !(r.criticality === "safety_critical" && !isGreen(e, d))) return false;
    if (view !== "" && view !== "verified" && e === "not_applicable") return false;
    if (authority && r.authority_code !== authority) return false;
    if (status && e !== status) return false;
    if (deadline && d !== deadline) return false;
    if (classroom && r.classroom_id !== classroom) return false;
    if (owner === "none" ? r.owner_id !== null : owner && r.owner_id !== owner) return false;
    if (needle && !`${r.requirement_title} ${r.requirement_code} ${r.subject_label ?? ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  return (
    <>
      <PageHeader title={VIEWS[view] ?? "All items"} description={`${rows.length} of ${all.length} open items you can see.`} />
      <Section title="Filters">
        <form className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Input name="q" defaultValue={q} placeholder="Search" aria-label="Search" className="col-span-2" />
          <Select name="view" defaultValue={view} aria-label="View">
            <option value="">Any view</option>
            {Object.entries(VIEWS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select name="authority" defaultValue={authority} aria-label="Authority">
            <option value="">Any authority</option>
            {["DHS", "STARS", "APPLE", "CECPD", "INTERNAL"].map((a) => <option key={a}>{a}</option>)}
          </Select>
          <Select name="status" defaultValue={status} aria-label="Evidence status">
            <option value="">Any evidence status</option>
            {Object.entries(EVIDENCE_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select name="deadline" defaultValue={deadline} aria-label="Due date">
            <option value="">Any due date</option>
            {Object.entries(DEADLINE_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select name="classroom" defaultValue={classroom} aria-label="Classroom">
            <option value="">Any classroom</option>
            {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select name="owner" defaultValue={owner} aria-label="Owner">
            <option value="">Any owner</option>
            <option value="none">Unassigned</option>
            {[...names].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
          <div className="col-span-2 flex gap-2">
            <Button type="submit" size="sm">Apply</Button>
            <Button asChild variant="outline" size="sm"><Link href="/items">Clear</Link></Button>
          </div>
        </form>
      </Section>
      <Section title="Items">
        <ItemsTable rows={rows} names={names} empty="No items match these filters." />
      </Section>
    </>
  );
}
