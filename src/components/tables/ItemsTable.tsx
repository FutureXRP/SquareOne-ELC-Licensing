import Link from "next/link";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Empty, Table, Td, Th } from "@/components/tables/Table";
import type { Views } from "@/lib/database.types";
import { formatDateOnly } from "@/lib/dates";

export type StatusRow = Views<"v_requirement_status">;

/** Requirement items with both statuses side by side. Used by every checklist-style screen. */
export function ItemsTable({
  rows,
  names,
  showSubject = true,
  empty = "Nothing here.",
}: {
  rows: readonly StatusRow[];
  names?: Map<string, string>;
  showSubject?: boolean;
  empty?: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Requirement</Th>
          {showSubject ? <Th>Applies to</Th> : null}
          <Th>Status</Th>
          <Th>Due</Th>
          {names ? <Th>Owner</Th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.requirement_instance_id}>
            <Td>
              <Link href={`/items/${r.requirement_instance_id}`} className="font-medium hover:underline">
                {r.requirement_title}
              </Link>
              <span className="block text-xs text-muted-foreground">
                {r.requirement_code} · {r.authority_code}
                {(r.cycle_number ?? 1) > 1 ? ` · cycle ${r.cycle_number}` : ""}
              </span>
            </Td>
            {showSubject ? <Td>{r.subject_label ?? "—"}</Td> : null}
            <Td>{r.evidence_status && r.deadline_status ? <StatusBadge evidence={r.evidence_status} deadline={r.deadline_status} /> : null}</Td>
            <Td className="whitespace-nowrap">{r.due_date ? formatDateOnly(r.due_date) : "—"}</Td>
            {names ? <Td>{(r.owner_id && names.get(r.owner_id)) || "Unassigned"}</Td> : null}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
