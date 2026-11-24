import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import { parseCsv } from "@/lib/csv/parse";

/**
 * CSV import: preview, validation and duplicate detection (phase 2). Pure.
 * Nothing is written here; the server action inserts only rows marked "ready".
 */

export type ImportKind = "staff" | "credentials" | "training";

const date = z.string().refine(isDateOnly, "use YYYY-MM-DD");
const optionalDate = date.optional();

const schemas = {
  staff: z.object({
    employee_code: z.string().min(1).max(40),
    first_name: z.string().min(1).max(80),
    last_name: z.string().min(1).max(80),
    role_title: z.string().max(80).optional(),
    classroom: z.string().max(80).optional(),
    hire_date: optionalDate,
  }),
  credentials: z.object({
    employee_code: z.string().min(1),
    credential_type: z.string().min(1),
    issuer: z.string().max(120).optional(),
    issue_date: optionalDate,
    expiration_date: optionalDate,
  }),
  training: z.object({
    employee_code: z.string().min(1),
    course_title: z.string().min(1).max(200),
    provider: z.string().max(120).optional(),
    completion_date: date,
    minutes: z.coerce.number().int("whole minutes only").positive().max(6000),
    category: z.string().max(80).optional(),
    certificate_identifier: z.string().max(120).optional(),
  }),
} as const;

export const IMPORT_COLUMNS: Record<ImportKind, readonly string[]> = {
  staff: ["employee_code", "first_name", "last_name", "role_title", "classroom", "hire_date"],
  credentials: ["employee_code", "credential_type", "issuer", "issue_date", "expiration_date"],
  training: ["employee_code", "course_title", "provider", "completion_date", "minutes", "category", "certificate_identifier"],
};

export type ImportRow = {
  line: number;
  values: Record<string, string>;
  status: "ready" | "error" | "duplicate";
  problem: string | null;
};

export type ImportPreview = { kind: ImportKind; rows: ImportRow[]; headerProblem: string | null };

export type ImportLookups = {
  /** Lower-cased employee codes already on file. */
  employeeCodes: ReadonlySet<string>;
  classrooms: ReadonlySet<string>;
  credentialTypes: ReadonlySet<string>;
  /** Keys of records already on file, see duplicateKey(). */
  existingKeys: ReadonlySet<string>;
};

export function duplicateKey(kind: ImportKind, v: Record<string, string | undefined>): string {
  const n = (s: string | undefined) => (s ?? "").trim().toLowerCase();
  if (kind === "staff") return n(v.employee_code);
  if (kind === "credentials") return [n(v.employee_code), n(v.credential_type), n(v.expiration_date)].join("|");
  return [n(v.employee_code), n(v.course_title), n(v.completion_date), n(v.certificate_identifier)].join("|");
}

export function previewImport(kind: ImportKind, csvText: string, lookups: ImportLookups): ImportPreview {
  const table = parseCsv(csvText);
  if (table.length === 0) return { kind, rows: [], headerProblem: "The file is empty." };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const required = IMPORT_COLUMNS[kind].filter((c) => !schemas[kind].shape[c as keyof (typeof schemas)[typeof kind]["shape"]].safeParse(undefined).success);
  const missing = required.filter((c) => !header.includes(c));
  if (missing.length > 0) return { kind, rows: [], headerProblem: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` };

  const seen = new Set<string>();
  const rows: ImportRow[] = table.slice(1).map((cells, index) => {
    const values: Record<string, string> = {};
    header.forEach((h, i) => {
      if (IMPORT_COLUMNS[kind].includes(h)) values[h] = (cells[i] ?? "").trim();
    });
    const candidate = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === "" ? undefined : v]));
    const parsed = schemas[kind].safeParse(candidate);
    const row: ImportRow = { line: index + 2, values, status: "ready", problem: null };
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ...row, status: "error", problem: `${issue.path.join(".")}: ${issue.message}` };
    }
    const code = (values.employee_code ?? "").toLowerCase();
    if (kind !== "staff" && !lookups.employeeCodes.has(code)) {
      return { ...row, status: "error", problem: "No staff member with this employee code." };
    }
    if (kind === "staff" && values.classroom && !lookups.classrooms.has(values.classroom.toLowerCase())) {
      return { ...row, status: "error", problem: "Unknown classroom." };
    }
    if (kind === "credentials" && !lookups.credentialTypes.has((values.credential_type ?? "").toLowerCase())) {
      return { ...row, status: "error", problem: "Unknown credential type." };
    }
    const key = duplicateKey(kind, values);
    if (lookups.existingKeys.has(key)) return { ...row, status: "duplicate", problem: "Already on file." };
    if (seen.has(key)) return { ...row, status: "duplicate", problem: "Repeated in this file." };
    seen.add(key);
    return row;
  });
  return { kind, rows, headerProblem: null };
}
