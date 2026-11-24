"use server";

import { z } from "zod";
import { DIRECTOR, OFFICE, STAFF_ROLES, runAction } from "@/lib/auth/action";
import { dbFail, done, fail, parseForm, type ActionState } from "@/lib/actions";
import { checkbox, dateOnly, optionalDate, optionalText, optionalUuid, text, uuid } from "@/lib/validation/common";

const staffFields = z.object({
  employee_code: text(40),
  first_name: text(80),
  last_name: text(80),
  role_title: optionalText(80),
  classroom_id: optionalUuid,
  hire_date: optionalDate,
  supervisor_id: optionalUuid,
  pdl_level: z.coerce.number().int().min(1).max(11).optional(),
  pdl_renewal_date: optionalDate,
});

export async function createStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(staffFields, fd);
  if (error) return error;
  return runAction(OFFICE, async ({ db }) => {
    const { error: e } = await db.from("staff").insert({
      ...data,
      role_title: data.role_title ?? null,
      classroom_id: data.classroom_id ?? null,
      hire_date: data.hire_date ?? null,
      supervisor_id: data.supervisor_id ?? null,
      pdl_level: data.pdl_level ?? null,
      pdl_renewal_date: data.pdl_renewal_date ?? null,
    });
    return e ? dbFail(e) : done("Staff member added. Their file items were opened.");
  });
}

export async function updateStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = staffFields.extend({
    id: uuid,
    employment_status: z.enum(["active", "on_leave", "separated"]),
    separation_date: optionalDate,
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  if (data.employment_status === "separated" && !data.separation_date) return fail("Enter the separation date.");
  return runAction(OFFICE, async ({ db }) => {
    const { id, ...rest } = data;
    const { error: e } = await db
      .from("staff")
      .update({
        ...rest,
        role_title: rest.role_title ?? null,
        classroom_id: rest.classroom_id ?? null,
        hire_date: rest.hire_date ?? null,
        supervisor_id: rest.supervisor_id ?? null,
        pdl_level: rest.pdl_level ?? null,
        pdl_renewal_date: rest.pdl_renewal_date ?? null,
        separation_date: rest.employment_status === "separated" ? (rest.separation_date ?? null) : null,
      })
      .eq("id", id);
    if (e) return dbFail(e);
    return done(
      data.employment_status === "separated"
        ? "Saved. Their login is off, open tasks and reminders are cancelled, and records are kept."
        : "Saved.",
    );
  });
}

export async function addCredential(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    staff_id: uuid,
    credential_type_id: uuid,
    issuer: optionalText(120),
    issue_date: optionalDate,
    expiration_date: optionalDate,
    internal_review_date: optionalDate,
    renewal_owner_id: optionalUuid,
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(OFFICE, async ({ db }) => {
    const { data: type } = await db.from("credential_types").select("requires_expiration").eq("id", data.credential_type_id).maybeSingle();
    if (type?.requires_expiration && !data.expiration_date) return fail("This credential type needs an expiration date.");
    const { error: e } = await db.from("credentials").insert({
      staff_id: data.staff_id,
      credential_type_id: data.credential_type_id,
      issuer: data.issuer ?? null,
      issue_date: data.issue_date ?? null,
      expiration_date: data.expiration_date ?? null,
      internal_review_date: data.internal_review_date ?? null,
      renewal_owner_id: data.renewal_owner_id ?? null,
    });
    return e ? dbFail(e) : done("Credential recorded. It is unverified until a director reviews it.");
  });
}

/** A director confirms they have seen the credential. Background checks record eligibility only. */
export async function verifyCredential(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({ id: uuid, eligibility_status: z.enum(["eligible", "ineligible", "pending"]).optional() });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db, session }) => {
    const { error: e } = await db
      .from("credentials")
      .update({
        verified_at: new Date().toISOString(),
        reviewer_id: session.userId,
        ...(data.eligibility_status ? { eligibility_status: data.eligibility_status } : {}),
      })
      .eq("id", data.id);
    return e ? dbFail(e) : done("Credential verified.");
  });
}

/** Training is entered as hours and minutes and stored as integer minutes. */
export async function addTraining(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    staff_id: uuid,
    course_title: text(200),
    provider: optionalText(120),
    completion_date: dateOnly,
    hours: z.coerce.number().int().min(0).max(100).default(0),
    minutes: z.coerce.number().int().min(0).max(59).default(0),
    category: optionalText(80),
    certificate_identifier: optionalText(120),
    reporting_period_id: optionalUuid,
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  const total = data.hours * 60 + data.minutes;
  if (total <= 0) return fail("Enter the length of the training.");
  return runAction(STAFF_ROLES, async ({ db }) => {
    const { error: e } = await db.from("training_records").insert({
      staff_id: data.staff_id,
      course_title: data.course_title,
      provider: data.provider ?? null,
      completion_date: data.completion_date,
      minutes: total,
      category: data.category ?? null,
      certificate_identifier: data.certificate_identifier ?? null,
      reporting_period_id: data.reporting_period_id ?? null,
    });
    if (e?.code === "23505") return fail("This training is already on file for that person and date. It was not added again.");
    return e ? dbFail(e) : done("Training recorded as pending. It counts once a director verifies it.");
  });
}

export async function reviewTraining(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({ id: uuid, state: z.enum(["verified", "ineligible"]), registry_verified: checkbox });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db, session }) => {
    const { error: e } = await db
      .from("training_records")
      .update({ state: data.state, reviewer_id: session.userId, registry_verified: data.registry_verified })
      .eq("id", data.id);
    return e ? dbFail(e) : done(data.state === "verified" ? "Training verified." : "Marked ineligible.");
  });
}
