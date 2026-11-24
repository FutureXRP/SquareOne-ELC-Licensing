"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { duplicateKey, previewImport, type ImportKind, type ImportPreview } from "@/lib/csv/imports";
import { fetchAll } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export type ImportState = { preview: ImportPreview | null; message: string | null; ok: boolean; csv: string; kind: ImportKind };

const KINDS: ImportKind[] = ["staff", "credentials", "training"];
const MAX_CHARS = 1_000_000;

/**
 * Two steps on one form: "Preview" validates and shows every row; "Import" re-validates the
 * same text against current records and inserts only the rows that are ready.
 */
export async function runImport(prev: ImportState, fd: FormData): Promise<ImportState> {
  const kind = KINDS.find((k) => k === fd.get("kind")) ?? "staff";
  const file = fd.get("file");
  let csv = String(fd.get("csv") ?? "");
  if (file instanceof File && file.size > 0) csv = await file.text();
  const base: ImportState = { preview: null, message: null, ok: false, csv, kind };
  if (csv.trim() === "") return { ...base, message: "Choose a CSV file or paste its contents." };
  if (csv.length > MAX_CHARS) return { ...base, csv: "", message: "That file is too large. Split it into smaller files." };

  const session = await getSession();
  if (!session?.role || !["director", "admin_support"].includes(session.role)) {
    return { ...base, message: "You do not have permission to import." };
  }
  const db = await createClient();
  const [staff, classrooms, types] = await Promise.all([
    fetchAll((a, b) => db.from("staff").select("id, employee_code").range(a, b)),
    fetchAll((a, b) => db.from("classrooms").select("id, name").is("archived_at", null).range(a, b)),
    fetchAll((a, b) => db.from("credential_types").select("id, name").is("archived_at", null).range(a, b)),
  ]);
  const staffByCode = new Map(staff.map((s) => [s.employee_code.toLowerCase(), s.id]));
  const codeById = new Map(staff.map((s) => [s.id, s.employee_code]));
  const classroomByName = new Map(classrooms.map((c) => [c.name.toLowerCase(), c.id]));
  const typeByName = new Map(types.map((t) => [t.name.toLowerCase(), t.id]));
  const typeNameById = new Map(types.map((t) => [t.id, t.name]));

  const existingKeys = new Set<string>();
  if (kind === "staff") for (const s of staff) existingKeys.add(duplicateKey("staff", { employee_code: s.employee_code }));
  if (kind === "credentials") {
    const rows = await fetchAll((a, b) => db.from("credentials").select("staff_id, credential_type_id, expiration_date").is("archived_at", null).range(a, b));
    for (const r of rows) {
      existingKeys.add(duplicateKey("credentials", { employee_code: codeById.get(r.staff_id), credential_type: typeNameById.get(r.credential_type_id), expiration_date: r.expiration_date ?? "" }));
    }
  }
  if (kind === "training") {
    const rows = await fetchAll((a, b) => db.from("training_records").select("staff_id, course_title, completion_date, certificate_identifier").range(a, b));
    for (const r of rows) {
      existingKeys.add(duplicateKey("training", { employee_code: codeById.get(r.staff_id), course_title: r.course_title, completion_date: r.completion_date, certificate_identifier: r.certificate_identifier ?? "" }));
    }
  }

  const preview = previewImport(kind, csv, {
    employeeCodes: new Set(staffByCode.keys()),
    classrooms: new Set(classroomByName.keys()),
    credentialTypes: new Set(typeByName.keys()),
    existingKeys,
  });
  if (preview.headerProblem) return { ...base, preview, message: preview.headerProblem };
  const ready = preview.rows.filter((r) => r.status === "ready");
  if (fd.get("intent") !== "import") {
    return { ...base, preview, ok: true, message: `${ready.length} of ${preview.rows.length} rows are ready to import. Nothing has been saved yet.` };
  }
  if (ready.length === 0) return { ...base, preview, message: "No rows are ready to import." };

  const opt = (v: string | undefined) => (v === undefined || v === "" ? null : v);
  let error: { message: string } | null = null;
  if (kind === "staff") {
    ({ error } = await db.from("staff").insert(
      ready.map((r) => ({
        employee_code: r.values.employee_code,
        first_name: r.values.first_name,
        last_name: r.values.last_name,
        role_title: opt(r.values.role_title),
        classroom_id: r.values.classroom ? (classroomByName.get(r.values.classroom.toLowerCase()) ?? null) : null,
        hire_date: opt(r.values.hire_date),
      })),
    ));
  } else if (kind === "credentials") {
    ({ error } = await db.from("credentials").insert(
      ready.map((r) => ({
        staff_id: staffByCode.get(r.values.employee_code.toLowerCase())!,
        credential_type_id: typeByName.get(r.values.credential_type.toLowerCase())!,
        issuer: opt(r.values.issuer),
        issue_date: opt(r.values.issue_date),
        expiration_date: opt(r.values.expiration_date),
      })),
    ));
  } else {
    ({ error } = await db.from("training_records").insert(
      ready.map((r) => ({
        staff_id: staffByCode.get(r.values.employee_code.toLowerCase())!,
        course_title: r.values.course_title,
        provider: opt(r.values.provider),
        completion_date: r.values.completion_date,
        minutes: Number(r.values.minutes),
        category: opt(r.values.category),
        certificate_identifier: opt(r.values.certificate_identifier),
      })),
    ));
  }
  if (error) return { ...base, preview, message: "The import was rejected by the database and nothing was saved. Preview again." };
  revalidatePath("/", "layout");
  return { preview: null, csv: "", kind, ok: true, message: `Imported ${ready.length} row${ready.length === 1 ? "" : "s"}. Imported credentials and training are unverified until reviewed.` };
}
