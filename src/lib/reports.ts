import "server-only";
import { fetchAll, listClassrooms, profileNames, type Db } from "@/lib/data";
import { chicagoToday, daysBetween } from "@/lib/dates";
import { nextAction, actionRank } from "@/lib/domain/overview";
import { DEADLINE_STATUS_LABEL, EVIDENCE_STATUS_LABEL } from "@/lib/domain/status";
import { summarizeTraining } from "@/lib/domain/training";

/** One definition per report, used by the printable page and the CSV export alike. */
export type Report = {
  title: string;
  /** What the reader should know about how to read the verification columns. */
  note: string;
  filters: string;
  columns: string[];
  rows: (string | number)[][];
};

export const REPORT_TYPES = {
  "director-action": "Director action report",
  "credential-matrix": "Staff credential matrix",
  training: "Training report",
  "evidence-index": "Evidence index (DHS, STARS or APPLE)",
  "file-audit": "Quarterly file audit",
  inspections: "Inspection and corrective action history",
  "renewal-calendar": "30 / 60 / 90 renewal calendar",
  "child-files": "Child file checklist",
} as const;

export type ReportType = keyof typeof REPORT_TYPES;
export const isReportType = (t: string): t is ReportType => t in REPORT_TYPES;

const AUTHORITIES = ["DHS", "STARS", "APPLE", "CECPD", "INTERNAL"] as const;
const hours = (minutes: number) => (minutes / 60).toFixed(2);
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export async function buildReport(db: Db, type: ReportType, params: { authority?: string }): Promise<Report> {
  const title = REPORT_TYPES[type];
  const statusNote = "Verification status is computed from reviewed evidence. Unknown means the requirement's source is not confirmed.";

  if (type === "director-action") {
    const rows = await fetchAll((a, b) => db.from("v_requirement_status").select("*").is("closed_at", null).order("requirement_instance_id").range(a, b));
    const names = await profileNames(db, rows.map((r) => r.owner_id));
    const ranked = rows
      .map((r) => ({ r, rank: actionRank({ evidenceStatus: r.evidence_status!, deadlineStatus: r.deadline_status!, criticality: r.criticality }) }))
      .filter((x) => x.rank !== null)
      .sort((x, y) => x.rank! - y.rank! || (x.r.due_date ?? "9999").localeCompare(y.r.due_date ?? "9999"));
    return {
      title, note: statusNote, filters: "Open items that are not green, most pressing first",
      columns: ["Code", "Requirement", "Authority", "Applies to", "Evidence status", "Deadline status", "Due", "Owner", "Next step"],
      rows: ranked.map(({ r }) => [r.requirement_code!, r.requirement_title!, r.authority_code!, r.subject_label ?? "", EVIDENCE_STATUS_LABEL[r.evidence_status!], DEADLINE_STATUS_LABEL[r.deadline_status!], r.due_date ?? "", (r.owner_id && names.get(r.owner_id)) || "Unassigned", nextAction(r.evidence_status!, r.deadline_status!)]),
    };
  }

  if (type === "credential-matrix") {
    const creds = await fetchAll((a, b) => db.from("v_credentials").select("*").order("staff_name").range(a, b));
    return {
      title, note: "Verified means a director has seen the credential and it has not expired. An expired credential is never shown as verified.", filters: "Latest credential of each type, current staff",
      columns: ["Staff", "Credential", "Issuer", "Issued", "Expires", "Standing", "Deadline status", "Verified on"],
      rows: creds.filter((c) => c.is_latest && c.employment_status !== "separated").map((c) => [c.staff_name!, c.credential_name!, c.issuer ?? "", c.issue_date ?? "", c.expiration_date ?? "", c.deadline_status === "overdue" ? "Expired" : c.is_verified_current ? "Verified" : "Unverified", DEADLINE_STATUS_LABEL[c.deadline_status!], day(c.verified_at)]),
    };
  }

  if (type === "training") {
    const [staff, records, periods, targets] = await Promise.all([
      fetchAll((a, b) => db.from("staff").select("id, first_name, last_name, role_title, employment_status").is("archived_at", null).order("last_name").range(a, b)),
      fetchAll((a, b) => db.from("training_records").select("staff_id, minutes, state, completion_date, reporting_period_id").is("archived_at", null).range(a, b)),
      fetchAll((a, b) => db.from("reporting_periods").select("*").is("archived_at", null).order("start_date", { ascending: false }).range(a, b)),
      fetchAll((a, b) => db.from("training_targets").select("*").is("archived_at", null).range(a, b)),
    ]);
    const period = periods[0];
    return {
      title, note: "Only verified training counts. Hours are stored as whole minutes; duplicates cannot be entered twice.", filters: period ? `Reporting period: ${period.label}` : "All dates (no reporting period set)",
      columns: ["Staff", "Role", "Verified hours", "Pending hours", "Target hours", "Target confirmed", "Remaining hours"],
      rows: staff.filter((s) => s.employment_status !== "separated").map((s) => {
        const mine = records.filter((r) => r.staff_id === s.id && (!period || r.reporting_period_id === period.id || (r.completion_date >= period.start_date && r.completion_date <= period.end_date)));
        const target = period ? targets.find((t) => t.reporting_period_id === period.id && t.role_title === s.role_title) : undefined;
        const sum = summarizeTraining(mine, target?.target_minutes ?? null);
        return [`${s.first_name} ${s.last_name}`, s.role_title ?? "", hours(sum.verifiedMinutes), hours(sum.pendingMinutes), sum.targetMinutes === null ? "Not set" : hours(sum.targetMinutes), target ? (target.confirmed ? "Yes" : "No (internal target)") : "", sum.remainingMinutes === null ? "" : hours(sum.remainingMinutes)];
      }),
    };
  }

  if (type === "evidence-index") {
    const authority = AUTHORITIES.find((a) => a === params.authority) ?? "DHS";
    const [items, links] = await Promise.all([
      fetchAll((a, b) => db.from("v_requirement_status").select("*").eq("authority_code", authority).is("closed_at", null).order("requirement_code").order("subject_label").range(a, b)),
      fetchAll((a, b) => db.from("v_review_queue").select("requirement_instance_id, file_name, status, reviewed_at, expiry_date").eq("authority_code", authority).eq("status", "approved").range(a, b)),
    ]);
    return {
      title: `${authority} evidence index`, note: statusNote, filters: `Authority: ${authority}`,
      columns: ["Code", "Requirement", "Applies to", "Evidence status", "Deadline status", "Due", "Approved documents"],
      rows: items.map((r) => [r.requirement_code!, r.requirement_title!, r.subject_label ?? "", EVIDENCE_STATUS_LABEL[r.evidence_status!], DEADLINE_STATUS_LABEL[r.deadline_status!], r.due_date ?? "", links.filter((l) => l.requirement_instance_id === r.requirement_instance_id).map((l) => `${l.file_name} (approved ${day(l.reviewed_at)}${l.expiry_date ? `, expires ${l.expiry_date}` : ""})`).join("; ")]),
    };
  }

  if (type === "file-audit" || type === "child-files") {
    const subject = type === "child-files" ? "child" : "staff";
    // Child export: checklist status only. No documents, no staff records, no health details.
    const [items, classrooms] = await Promise.all([
      fetchAll((a, b) => db.from("v_requirement_status").select("*").eq("subject_type", subject).is("closed_at", null).order("subject_label").order("requirement_code").range(a, b)),
      listClassrooms(db),
    ]);
    const room = new Map(classrooms.map((c) => [c.id, c.name]));
    return {
      title, note: statusNote, filters: subject === "child" ? "Child file checklist items only" : "Staff file checklist items",
      columns: [subject === "child" ? "Child" : "Staff", "Classroom", "Code", "Requirement", "Evidence status", "Deadline status", "Due"],
      rows: items.map((r) => [r.subject_label ?? "", (r.classroom_id && room.get(r.classroom_id)) || "", r.requirement_code!, r.requirement_title!, EVIDENCE_STATUS_LABEL[r.evidence_status!], DEADLINE_STATUS_LABEL[r.deadline_status!], r.due_date ?? ""]),
    };
  }

  if (type === "inspections") {
    const [inspections, findings, actions, authorities] = await Promise.all([
      fetchAll((a, b) => db.from("inspections").select("*").order("inspection_date", { ascending: false }).range(a, b)),
      fetchAll((a, b) => db.from("findings").select("*").range(a, b)),
      fetchAll((a, b) => db.from("corrective_actions").select("*").range(a, b)),
      fetchAll((a, b) => db.from("authorities").select("id, code").range(a, b)),
    ]);
    const names = await profileNames(db, [...actions.map((x) => x.owner_id), ...actions.map((x) => x.verified_by)]);
    const auth = new Map(authorities.map((a) => [a.id, a.code]));
    const rows: (string | number)[][] = [];
    for (const i of inspections) {
      const fs = findings.filter((f) => f.inspection_id === i.id);
      if (fs.length === 0) rows.push([i.inspection_date, auth.get(i.authority_id) ?? "", i.kind, "No findings", "", "", "", "", ""]);
      for (const f of fs) {
        const as = actions.filter((x) => x.finding_id === f.id);
        for (const x of as.length > 0 ? as : [null]) {
          rows.push([i.inspection_date, auth.get(i.authority_id) ?? "", i.kind, f.description, x?.description ?? "", (x?.owner_id && names.get(x.owner_id)) || "", x?.due_date ?? "", x ? (x.verified_at ? "Closed (verified)" : "Open") : "", x?.verified_at ? `${day(x.verified_at)} by ${(x.verified_by && names.get(x.verified_by)) || "director"}` : ""]);
        }
      }
    }
    return { title, note: "A corrective action is closed only when a director verifies the closure.", filters: "All inspections", columns: ["Date", "Authority", "Kind", "Finding", "Corrective action", "Owner", "Due", "State", "Closure verified"], rows };
  }

  const items = await fetchAll((a, b) => db.from("v_deadline_items").select("*").order("due_date").range(a, b));
  const today = chicagoToday();
  const names = await profileNames(db, items.map((i) => i.owner_id));
  return {
    title, note: "Verified items listed here are current now and coming up for renewal.", filters: "Overdue and due within 90 days",
    columns: ["Due", "Days left", "Item", "Applies to", "Kind", "Deadline status", "Currently verified", "Owner"],
    rows: items.filter((i) => daysBetween(today, i.due_date!) <= 90).map((i) => [i.due_date!, daysBetween(today, i.due_date!), i.title!, i.subject_label ?? "", i.kind === "credential" ? "Credential" : "Requirement", DEADLINE_STATUS_LABEL[i.deadline_status!], i.verified ? "Yes" : "No", (i.owner_id && names.get(i.owner_id)) || "Unassigned"]),
  };
}
