"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DIRECTOR, STAFF_ROLES, runAction } from "@/lib/auth/action";
import { dbFail, done, fail, parseForm, type ActionState } from "@/lib/actions";
import { getSession } from "@/lib/auth/session";
import { chicagoToday } from "@/lib/dates";
import { nextDueDate, parseRecurrenceRule } from "@/lib/domain/deadlines";
import { createClient } from "@/lib/supabase/server";
import { optionalDate, optionalText, optionalUuid, text, uuid } from "@/lib/validation/common";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = /\.(pdf|png|jpe?g|webp|heic|docx?|xlsx?|csv|txt)$/i;

const evidenceMeta = z.object({
  doc_type: text(80),
  file_name: z.string().min(1).max(200),
  file_size: z.coerce.number().int().positive().max(MAX_BYTES, "Files can be up to 20 MB."),
  access_class: z.enum(["general", "personnel", "child_health", "restricted"]),
  subject_type: z.enum(["program", "role", "classroom", "staff", "child", "facility"]),
  subject_id: uuid,
  issue_date: optionalDate,
  expiry_date: optionalDate,
  requirement_instance_id: optionalUuid,
});

export type CreateEvidenceResult = { ok: true; id: string; path: string } | { ok: false; message: string };

/**
 * Step 1 of an upload: record the document. The browser then uploads the file straight to private storage at the returned
 * path (the storage policy only accepts that exact path from this uploader).
 * Uploading never verifies anything (rule 3).
 */
export async function createEvidence(input: Record<string, string>): Promise<CreateEvidenceResult> {
  const parsed = evidenceMeta.safeParse(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === "" ? undefined : v])));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const data = parsed.data;
  if (!ALLOWED.test(data.file_name)) return { ok: false, message: "That file type is not accepted." };
  const session = await getSession();
  if (!session?.role || session.role === "auditor") return { ok: false, message: "You do not have permission to upload." };

  const db = await createClient();
  const id = crypto.randomUUID();
  const safeName = data.file_name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120);
  const path = `${data.access_class}/${data.subject_type}/${data.subject_id}/${id}/${safeName}`;
  const { error } = await db.from("evidence").insert({
    id,
    doc_type: data.doc_type,
    storage_path: path,
    file_name: data.file_name,
    subject_type: data.subject_type,
    subject_id: data.subject_id,
    uploader_id: session.userId,
    access_class: data.access_class,
    issue_date: data.issue_date ?? null,
    expiry_date: data.expiry_date ?? null,
  });
  if (error) return { ok: false, message: dbFail(error).message ?? "Could not record the document." };
  return { ok: true, id, path };
}

/** Step 3 of an upload, after the file is safely stored: link it to the requirement as PENDING. */
export async function linkUploaded(evidenceId: string, instanceId: string): Promise<{ ok: boolean; message: string }> {
  const parsed = z.object({ evidenceId: uuid, instanceId: uuid }).safeParse({ evidenceId, instanceId });
  const session = await getSession();
  if (!parsed.success || !session?.role) return { ok: false, message: "The document could not be linked." };
  const db = await createClient();
  const { error } = await db.from("evidence_links").insert({ evidence_id: evidenceId, requirement_instance_id: instanceId });
  if (error) return { ok: false, message: dbFail(error).message ?? "The document could not be linked." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Uploaded. It is waiting for review." };
}

/** Link a document already on file to another requirement. Each link is reviewed separately. */
export async function linkEvidence(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ evidence_id: uuid, requirement_instance_id: uuid }), fd);
  if (error) return error;
  return runAction(STAFF_ROLES, async ({ db }) => {
    const { error: e } = await db.from("evidence_links").insert(data);
    return e ? dbFail(e) : done("Linked. It is waiting for review.");
  });
}

/**
 * The review decision. The next due date comes from the version's recurrence rule through
 * the pure function nextDueDate(); the database applies everything in one transaction.
 */
export async function reviewLink(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({ link_id: uuid, decision: z.enum(["approved", "rejected"]), correction_note: optionalText(1000) });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  if (data.decision === "rejected" && !data.correction_note) return fail("Say what needs correcting.");
  return runAction(DIRECTOR, async ({ db }) => {
    const { data: row } = await db.from("v_review_queue").select("*").eq("link_id", data.link_id).maybeSingle();
    if (!row) return fail("That submission is no longer available.");
    let nextDue: string | null = null;
    if (data.decision === "approved" && (row.frequency === "recurring" || row.frequency === "expiration_based")) {
      const rule = parseRecurrenceRule(row.recurrence_rule) ?? (row.frequency === "expiration_based" ? { type: "expiration" as const, source: "evidence.expiry_date" } : null);
      nextDue = nextDueDate(rule, {
        verifiedOn: chicagoToday(),
        previousDue: row.due_date,
        hireDate: row.subject_hire_date,
        evidenceExpiry: row.expiry_date,
      });
    }
    const { error: e } = await db.rpc("review_evidence_link", {
      p_link: data.link_id,
      p_decision: data.decision,
      p_note: data.correction_note ?? null,
      p_next_due: nextDue,
      p_set_due: nextDue !== null,
    });
    if (e) return dbFail(e);
    if (data.decision === "rejected") return done("Returned for correction. The submitter has a task and a notice.");
    return done(nextDue ? `Approved. Next due ${nextDue}.` : "Approved.");
  });
}
