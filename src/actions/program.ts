"use server";

import { z } from "zod";
import { DIRECTOR, OFFICE, STAFF_ROLES, runAction } from "@/lib/auth/action";
import { dbFail, done, fail, parseForm, type ActionState } from "@/lib/actions";
import { chicagoToday } from "@/lib/dates";
import { fetchAll } from "@/lib/data";
import type { Json } from "@/lib/database.types";
import { summarizeOverview } from "@/lib/domain/overview";
import { dateOnly, optionalDate, optionalText, optionalUuid, text, uuid } from "@/lib/validation/common";

// ---------- safety ----------
export async function addSafetyCheck(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    classroom_id: optionalUuid,
    check_type: z.enum(["weekly_checklist", "drill", "maintenance", "inspection"]),
    performed_on: dateOnly,
    result: z.enum(["pass", "issue_found"]),
    notes: optionalText(1000),
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  if (data.performed_on > chicagoToday()) return fail("A check cannot be dated in the future.");
  if (data.result === "issue_found" && !data.notes) return fail("Describe the issue that was found.");
  return runAction(STAFF_ROLES, async ({ db, session }) => {
    const { error: e } = await db.from("safety_checks").insert({
      classroom_id: data.classroom_id ?? null,
      check_type: data.check_type,
      performed_on: data.performed_on,
      result: data.result,
      notes: data.notes ?? null,
      performed_by: session.userId,
    });
    return e ? dbFail(e) : done("Check recorded.");
  });
}

export async function addInspection(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({ authority_id: uuid, inspection_date: dateOnly, inspector: optionalText(120), kind: text(60), summary: optionalText(2000) });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(OFFICE, async ({ db, session }) => {
    const { error: e } = await db.from("inspections").insert({ ...data, inspector: data.inspector ?? null, summary: data.summary ?? null, created_by: session.userId });
    return e ? dbFail(e) : done("Inspection recorded.");
  });
}

/** A finding and its corrective action are entered together; the action files a task. */
export async function addFinding(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    inspection_id: uuid,
    description: text(1000),
    criticality: z.enum(["safety_critical", "regulatory", "accreditation", "internal"]).optional(),
    action: text(1000),
    owner_id: optionalUuid,
    due_date: optionalDate,
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(OFFICE, async ({ db }) => {
    const { data: finding, error: e } = await db
      .from("findings")
      .insert({ inspection_id: data.inspection_id, description: data.description, criticality: data.criticality ?? null })
      .select("id")
      .single();
    if (e) return dbFail(e);
    const { error: e2 } = await db.from("corrective_actions").insert({
      finding_id: finding.id,
      description: data.action,
      owner_id: data.owner_id ?? null,
      due_date: data.due_date ?? null,
    });
    return e2 ? dbFail(e2) : done("Finding recorded with its corrective action.");
  });
}

/** Verified closure: a director confirms the corrective action is done, with evidence when there is any. */
export async function closeCorrectiveAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ id: uuid, evidence_id: optionalUuid }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db, session }) => {
    const { error: e } = await db
      .from("corrective_actions")
      .update({ verified_by: session.userId, verified_at: new Date().toISOString(), ...(data.evidence_id ? { evidence_id: data.evidence_id } : {}) })
      .eq("id", data.id)
      .is("verified_at", null);
    return e ? dbFail(e) : done("Closure verified.");
  });
}

// ---------- policies ----------
export async function createPolicy(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ title: text(160), category: optionalText(80), summary: optionalText(4000), effective_date: optionalDate }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { data: policy, error: e } = await db.from("policies").insert({ title: data.title, category: data.category ?? null }).select("id").single();
    if (e) return dbFail(e);
    const { error: e2 } = await db.from("policy_versions").insert({
      policy_id: policy.id,
      version_label: "v1",
      summary: data.summary ?? null,
      effective_date: data.effective_date ?? null,
      status: "active",
    });
    return e2 ? dbFail(e2) : done("Policy published. Staff can now acknowledge it.");
  });
}

export async function addPolicyVersion(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ policy_id: uuid, summary: text(4000), effective_date: optionalDate }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { count } = await db.from("policy_versions").select("id", { count: "exact", head: true }).eq("policy_id", data.policy_id);
    const { error: e } = await db.from("policy_versions").insert({
      policy_id: data.policy_id,
      version_label: `v${(count ?? 0) + 1}`,
      summary: data.summary,
      effective_date: data.effective_date ?? null,
      status: "active",
    });
    return e ? dbFail(e) : done("New version published. Earlier acknowledgments stay with the old version.");
  });
}

export async function acknowledgePolicy(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ policy_version_id: uuid }), fd);
  if (error) return error;
  return runAction(STAFF_ROLES, async ({ db, session }) => {
    const { error: e } = await db.from("policy_acknowledgments").insert({ policy_version_id: data.policy_version_id, profile_id: session.userId });
    if (e?.code === "23505") return done("Already acknowledged.");
    return e ? dbFail(e) : done("Acknowledged.");
  });
}

// ---------- children ----------
export async function addChild(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    child_code: text(40),
    first_name: text(60),
    last_initial: z.string().regex(/^[A-Za-z]$/, "One letter only."),
    classroom_id: optionalUuid,
    enrollment_date: optionalDate,
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(OFFICE, async ({ db }) => {
    const { error: e } = await db.from("children").insert({
      ...data,
      last_initial: data.last_initial.toUpperCase(),
      classroom_id: data.classroom_id ?? null,
      enrollment_date: data.enrollment_date ?? null,
    });
    return e ? dbFail(e) : done("Child added. Their file checklist was opened.");
  });
}

// ---------- quarterly reviews ----------
export async function openReviewCycle(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({ quarter: z.coerce.number().int().min(1).max(4), year: z.coerce.number().int().min(2020).max(2100) });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db, session }) => {
    const { error: e } = await db.from("review_cycles").insert({ ...data, opened_by: session.userId });
    return e ? dbFail(e) : done("Review opened.");
  });
}

/**
 * Sign-off writes an immutable, dated snapshot of what the review saw (counts, readiness
 * and every item that was not green), keeps the open follow-ups, then locks the cycle.
 */
export async function signOffReviewCycle(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ cycle_id: uuid, notes: optionalText(2000) }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db, session }) => {
    const { data: cycle } = await db.from("review_cycles").select("*").eq("id", data.cycle_id).maybeSingle();
    if (!cycle) return fail("Review not found.");
    if (cycle.signed_off_at) return fail("This review is already signed off.");

    const rows = await fetchAll((a, b) => db.from("v_requirement_status").select("*").is("closed_at", null).order("requirement_instance_id").range(a, b));
    const usable = rows.filter((r) => r.evidence_status && r.deadline_status && r.authority_code);
    const summary = summarizeOverview(
      usable.map((r) => ({ evidenceStatus: r.evidence_status!, deadlineStatus: r.deadline_status!, closedAt: r.closed_at, authorityCode: r.authority_code!, criticality: r.criticality })),
    );
    const exceptions = usable
      .filter((r) => !r.is_green && r.evidence_status !== "not_applicable")
      .map((r) => ({ code: r.requirement_code, title: r.requirement_title, subject: r.subject_label, evidence: r.evidence_status, deadline: r.deadline_status, due: r.due_date }));

    const followUps: string[] = [];
    if (exceptions.length > 0) {
      const { data: task, error: te } = await db
        .from("tasks")
        .insert({ title: `Q${cycle.quarter} ${cycle.year} review: resolve ${exceptions.length} exception${exceptions.length === 1 ? "" : "s"}`, kind: "follow_up", created_by: session.userId, assignee_id: session.userId })
        .select("id")
        .single();
      if (te) return dbFail(te);
      followUps.push(task.id);
    }
    const open = await fetchAll((a, b) => db.from("tasks").select("id").in("status", ["open", "in_progress"]).range(a, b));
    for (const t of open) if (!followUps.includes(t.id)) followUps.push(t.id);

    const { error: e } = await db.from("review_results").insert({
      cycle_id: cycle.id,
      scope: "program",
      snapshot: { taken_on: chicagoToday(), notes: data.notes ?? null, summary, item_count: usable.length } as unknown as Json,
      exceptions: exceptions as unknown as Json,
      follow_up_task_ids: followUps,
      created_by: session.userId,
    });
    if (e) return dbFail(e);
    const { error: e2 } = await db.from("review_cycles").update({ signed_off_by: session.userId, signed_off_at: new Date().toISOString() }).eq("id", cycle.id);
    return e2 ? dbFail(e2) : done("Signed off. The snapshot is saved and cannot be changed.");
  });
}

// ---------- auditor packets ----------
export async function createAuditorGrant(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    profile_id: uuid,
    label: text(120),
    authority: z.enum(["DHS", "STARS", "APPLE", "CECPD", "INTERNAL"]),
    days: z.coerce.number().int().min(1).max(30),
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db, session }) => {
    const { data: profile } = await db.from("profiles").select("role").eq("id", data.profile_id).maybeSingle();
    if (profile?.role !== "auditor") return fail("Packets can only be granted to an auditor account.");
    // Scope = that authority's requirements and only the evidence already approved for them.
    const queue = await fetchAll((a, b) =>
      db.from("v_review_queue").select("evidence_id, requirement_code, authority_code, status").eq("authority_code", data.authority).eq("status", "approved").range(a, b),
    );
    const { data: auth } = await db.from("authorities").select("id").eq("code", data.authority).single();
    const reqs = await fetchAll((a, b) => db.from("requirements").select("id").eq("authority_id", auth!.id).is("archived_at", null).range(a, b));
    const { error: e } = await db.from("auditor_grants").insert({
      profile_id: data.profile_id,
      label: data.label,
      scope: { requirement_ids: reqs.map((r) => r.id), evidence_ids: [...new Set(queue.map((q) => q.evidence_id))] } as unknown as Json,
      expires_at: new Date(Date.now() + data.days * 86_400_000).toISOString(),
      created_by: session.userId,
    });
    return e ? dbFail(e) : done(`Packet granted for ${data.days} day${data.days === 1 ? "" : "s"}.`);
  });
}

export async function revokeAuditorGrant(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ id: uuid }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { error: e } = await db.from("auditor_grants").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    return e ? dbFail(e) : done("Access revoked.");
  });
}
