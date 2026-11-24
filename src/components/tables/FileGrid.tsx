import Link from "next/link";
import type { StatusRow } from "@/components/tables/ItemsTable";
import { Empty } from "@/components/tables/Table";
import { EVIDENCE_STATUS_LABEL, statusTone } from "@/lib/domain/status";
import { cn } from "@/lib/utils";

const CELL = {
  green: "bg-status-green-bg text-status-green",
  amber: "bg-status-amber-bg text-status-amber",
  red: "bg-status-red-bg text-status-red",
  neutral: "bg-status-neutral-bg text-status-neutral",
} as const;

const SHORT: Record<string, string> = { verified: "OK", pending_review: "Review", needs_correction: "Fix", missing: "Missing", unknown: "?", not_applicable: "N/A" };

/** Subjects down the side, requirements across the top. A cell is green only when the item is green. */
export function FileGrid({ rows, empty }: { rows: readonly StatusRow[]; empty: string }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const reqs = [...new Map(rows.map((r) => [r.requirement_code!, r.requirement_title!])).entries()].sort();
  const subjects = [...new Map(rows.map((r) => [r.subject_id!, r.subject_label ?? ""])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const cell = new Map(rows.map((r) => [`${r.subject_id}|${r.requirement_code}`, r]));
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-card py-2 pr-3 text-left text-sm font-medium text-muted-foreground">Name</th>
            {reqs.map(([code, title]) => (
              <th key={code} scope="col" title={title} className="px-1 py-2 text-left font-medium text-muted-foreground">
                <span className="block w-20 truncate">{title}</span>
                <span className="font-mono font-normal">{code}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map(([id, label]) => (
            <tr key={id} className="border-t border-border">
              <th scope="row" className="sticky left-0 whitespace-nowrap bg-card py-1.5 pr-3 text-left text-sm font-medium">{label}</th>
              {reqs.map(([code]) => {
                const r = cell.get(`${id}|${code}`);
                if (!r) return <td key={code} className="px-1 py-1.5 text-center text-muted-foreground">·</td>;
                const tone = statusTone(r.evidence_status!, r.deadline_status!);
                const label2 = r.evidence_status === "verified" && tone !== "green" ? "Due" : SHORT[r.evidence_status!];
                return (
                  <td key={code} className="px-1 py-1.5">
                    <Link href={`/items/${r.requirement_instance_id}`} title={`${EVIDENCE_STATUS_LABEL[r.evidence_status!]} · deadline ${r.deadline_status}`} className={cn("block rounded px-1.5 py-1 text-center font-medium", CELL[tone])}>
                      {label2}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
