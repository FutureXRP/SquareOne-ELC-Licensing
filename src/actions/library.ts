"use server";

import { z } from "zod";
import { DIRECTOR, OFFICE, runAction } from "@/lib/auth/action";
import { dbFail, done, fail, parseForm, type ActionState } from "@/lib/actions";
import { chicagoToday } from "@/lib/dates";
import type { Json } from "@/lib/database.types";
import { parseRecurrenceRule } from "@/lib/domain/deadlines";
import { dateOnly, optionalDate, optionalText, optionalUuid, text, uuid } from "@/lib/validation/common";

const scope = z.enum(["program", "role", "classroom", "staff", "child", "facility"]);
const frequency = z.enum(["one_time", "recurring", "expiration_based", "event_triggered"]);
const criticality = z.enum(["safety_critical", "regulatory", "accreditation", "internal"]);

export async function createRequirement(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    code: z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,30}$/, "Use capitals, digits and dashes, like DHS-STAFF-010."),
    authority_id: uuid,
    title: text(200),
    category: optionalText(80),
    scope,
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { data: req, error: e } = await db
      .from("requirements")
      .insert({ code: data.code, authority_id: data.authority_id, title: data.title, category: data.category ?? null })
      .select("id")
      .single();
    if (e) return dbFail(e);
    const { error: e2 } = await db
      .from("requirement_versions")
      .insert({ requirement_id: req.id, version_label: "draft-1", scope: data.scope, status: "draft" });
    return e2 ? dbFail(e2) : done("Requirement added as a draft. It stays unknown until its source is confirmed.");
  });
}

/** Rule fields from the form -> the jsonb shape in BUILD.md section 5, or null. */
function ruleFromForm(v: Record<string, string | undefined>): { rule: Json | null; problem: string | null } {
  if (!v.rule_type || v.rule_type === "none") return { rule: null, problem: null };
  const raw =
    v.rule_type === "interval"
      ? { type: "interval", every: Number(v.rule_every), unit: v.rule_unit, anchor: v.rule_anchor }
      : v.rule_type === "fixed_months"
        ? { type: "fixed_months", months: (v.rule_months ?? "").split(/[\s,]+/).filter(Boolean).map(Number), day: Number(v.rule_day) }
        : v.rule_type === "expiration"
          ? { type: "expiration", source: "evidence.expiry_date" }
          : { type: "event", trigger: v.rule_trigger };
  const parsed = parseRecurrenceRule(raw);
  return parsed ? { rule: parsed as unknown as Json, problem: null } : { rule: null, problem: "The recurrence rule is incomplete." };
}

const versionFields = z.object({
  version_id: uuid,
  description: optionalText(2000),
  evidence_criteria: optionalText(2000),
  citation: optionalText(300),
  source_url: z.url("Enter the full web address of the official source.").optional(),
  last_source_review: optionalDate,
  effective_date: optionalDate,
  frequency: frequency.optional(),
  criticality: criticality.optional(),
  scope,
  applies_to_roles: optionalText(500),
  rule_type: z.string().optional(),
  rule_every: z.string().optional(),
  rule_unit: z.string().optional(),
  rule_anchor: z.string().optional(),
  rule_months: z.string().optional(),
  rule_day: z.string().optional(),
  rule_trigger: z.string().optional(),
});

async function saveVersion(fd: FormData, activate: boolean): Promise<ActionState> {
  const { data, error } = parseForm(versionFields, fd);
  if (error) return error;
  const { rule, problem } = ruleFromForm(data);
  if (problem) return fail(problem);
  if (activate) {
    if (!data.citation || !data.source_url || !data.last_source_review) {
      return fail("Activation needs the citation, the source link and the date you reviewed the source.");
    }
    if (!data.frequency || !data.criticality) return fail("Activation needs a frequency and a criticality.");
    if (data.last_source_review > chicagoToday()) return fail("The source review date cannot be in the future.");
  }
  return runAction(DIRECTOR, async ({ db, session }) => {
    const roles = (data.applies_to_roles ?? "").split(",").map((r) => r.trim()).filter(Boolean);
    const { data: updated, error: e } = await db
      .from("requirement_versions")
      .update({
        description: data.description ?? null,
        evidence_criteria: data.evidence_criteria ?? null,
        citation: data.citation ?? null,
        source_url: data.source_url ?? null,
        last_source_review: data.last_source_review ?? null,
        effective_date: data.effective_date ?? null,
        frequency: data.frequency ?? null,
        criticality: data.criticality ?? null,
        scope: data.scope,
        applies_to: roles.length > 0 ? { roles } : {},
        recurrence_rule: rule,
        ...(activate ? { status: "active" as const, reviewed_by: session.userId } : {}),
      })
      .eq("id", data.version_id)
      .eq("status", "draft")
      .select("id");
    if (e) return dbFail(e);
    if (!updated || updated.length === 0) return fail("Only a draft can be edited. Start a new version instead.");
    return done(activate ? "Activated. Items were opened for everyone this applies to." : "Draft saved.");
  });
}

export async function saveDraftVersion(_p: ActionState, fd: FormData): Promise<ActionState> {
  return saveVersion(fd, false);
}

export async function activateVersion(_p: ActionState, fd: FormData): Promise<ActionState> {
  return saveVersion(fd, true);
}

/** A rule changed: start a new draft copied from the current version. The old one stays active until the new one is. */
export async function startNewVersion(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ requirement_id: uuid }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { data: versions } = await db
      .from("requirement_versions")
      .select("*")
      .eq("requirement_id", data.requirement_id)
      .order("created_at", { ascending: false });
    if (!versions || versions.length === 0) return fail("Requirement not found.");
    if (versions.some((v) => v.status === "draft")) return fail("There is already a draft for this requirement.");
    const from = versions.find((v) => v.status === "active") ?? versions[0];
    const { error: e } = await db.from("requirement_versions").insert({
      requirement_id: from.requirement_id,
      version_label: `v${versions.length + 1}`,
      scope: from.scope,
      applies_to: from.applies_to,
      description: from.description,
      evidence_criteria: from.evidence_criteria,
      frequency: from.frequency,
      recurrence_rule: from.recurrence_rule,
      criticality: from.criticality,
      status: "draft",
    });
    return e ? dbFail(e) : done("New draft started. Confirm its source, then activate it.");
  });
}

export async function generateInstances(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ version_id: optionalUuid }), fd);
  if (error) return error;
  return runAction(OFFICE, async ({ db }) => {
    const { data: n, error: e } = await db.rpc("generate_instances", { p_version: data.version_id ?? null });
    return e ? dbFail(e) : done(n === 0 ? "Everything is already assigned." : `${n} item${n === 1 ? "" : "s"} opened.`);
  });
}

export async function updateInstance(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ id: uuid, due_date: optionalDate, owner_id: optionalUuid, backup_id: optionalUuid }), fd);
  if (error) return error;
  return runAction(OFFICE, async ({ db }) => {
    const { error: e } = await db
      .from("requirement_instances")
      .update({ due_date: data.due_date ?? null, owner_id: data.owner_id ?? null, backup_id: data.backup_id ?? null })
      .eq("id", data.id);
    return e ? dbFail(e) : done("Saved.");
  });
}

/** Set the same due date and owner on every open item of one version. */
export async function bulkUpdateInstances(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ version_id: uuid, due_date: dateOnly.optional(), owner_id: optionalUuid }), fd);
  if (error) return error;
  if (!data.due_date && !data.owner_id) return fail("Choose a due date or an owner.");
  return runAction(OFFICE, async ({ db }) => {
    const { data: rows, error: e } = await db
      .from("requirement_instances")
      .update({ ...(data.due_date ? { due_date: data.due_date } : {}), ...(data.owner_id ? { owner_id: data.owner_id } : {}) })
      .eq("requirement_version_id", data.version_id)
      .is("closed_at", null)
      .select("id");
    return e ? dbFail(e) : done(`${rows?.length ?? 0} items updated.`);
  });
}

export async function approveNotApplicable(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ id: uuid, na_reason: text(500) }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db, session }) => {
    const { error: e } = await db
      .from("requirement_instances")
      .update({ na_reason: data.na_reason, na_approved_by: session.userId, na_approved_at: new Date().toISOString() })
      .eq("id", data.id);
    return e ? dbFail(e) : done("Marked not applicable.");
  });
}
