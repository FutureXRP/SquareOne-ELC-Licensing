"use server";

import { z } from "zod";
import { DIRECTOR, runAction } from "@/lib/auth/action";
import { dbFail, done, fail, parseForm, type ActionState } from "@/lib/actions";
import { checkbox, dateOnly, optionalText, text, uuid } from "@/lib/validation/common";

export async function saveThresholds(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z
    .object({ due_soon_days: z.coerce.number().int().min(1).max(365), urgent_days: z.coerce.number().int().min(0).max(365) })
    .refine((v) => v.urgent_days < v.due_soon_days, "Urgent must be fewer days than due soon.");
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    for (const [key, value] of Object.entries(data)) {
      const { error: e } = await db.from("settings").update({ value }).eq("key", key);
      if (e) return dbFail(e);
    }
    return done("Thresholds saved.");
  });
}

export async function setChildRecords(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ enabled: checkbox }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { error: e } = await db.from("settings").update({ value: data.enabled }).eq("key", "child_records_enabled");
    return e ? dbFail(e) : done(data.enabled ? "Child records are on." : "Child records are off.");
  });
}

export async function addClassroom(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ name: text(80) }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { data: program } = await db.from("programs").select("id").is("archived_at", null).limit(1).maybeSingle();
    if (!program) return fail("Set up the program first.");
    const { error: e } = await db.from("classrooms").insert({ name: data.name, program_id: program.id });
    return e ? dbFail(e) : done("Classroom added.");
  });
}

export async function renameClassroom(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ id: uuid, name: text(80) }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { error: e } = await db.from("classrooms").update({ name: data.name }).eq("id", data.id);
    return e ? dbFail(e) : done("Saved.");
  });
}

export async function saveProgram(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    id: uuid,
    name: text(120),
    licensed_capacity: z.coerce.number().int().positive().max(2000).optional(),
    quality_designation: optionalText(120),
    accreditation_name: optionalText(120),
    accreditation_date: dateOnly.optional(),
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { id, ...rest } = data;
    const { error: e } = await db
      .from("programs")
      .update({
        name: rest.name,
        licensed_capacity: rest.licensed_capacity ?? null,
        quality_designation: rest.quality_designation ?? null,
        accreditation_name: rest.accreditation_name ?? null,
        accreditation_date: rest.accreditation_date ?? null,
      })
      .eq("id", id);
    return e ? dbFail(e) : done("Program saved.");
  });
}

export async function addCredentialType(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ name: text(120), category: optionalText(80), requires_expiration: checkbox }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { error: e } = await db.from("credential_types").insert({ ...data, category: data.category ?? null });
    return e ? dbFail(e) : done("Credential type added.");
  });
}

export async function addReportingPeriod(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ label: text(80), start_date: dateOnly, end_date: dateOnly }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { error: e } = await db.from("reporting_periods").insert(data);
    return e ? dbFail(e) : done("Reporting period added.");
  });
}

/** Training targets are entered in hours and stored as integer minutes. */
export async function saveTrainingTarget(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    role_title: text(80),
    reporting_period_id: uuid,
    hours: z.coerce.number().min(0).max(500).refine((h) => Number.isInteger(h * 60), "Use whole minutes."),
    confirmed: checkbox,
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { error: e } = await db.from("training_targets").upsert(
      {
        role_title: data.role_title,
        reporting_period_id: data.reporting_period_id,
        target_minutes: Math.round(data.hours * 60),
        confirmed: data.confirmed,
      },
      { onConflict: "role_title,reporting_period_id" },
    );
    return e ? dbFail(e) : done("Target saved.");
  });
}
