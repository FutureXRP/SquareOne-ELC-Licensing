"use server";

import { z } from "zod";
import { OFFICE, STAFF_ROLES, runAction } from "@/lib/auth/action";
import { dbFail, done, parseForm, type ActionState } from "@/lib/actions";
import { optionalDate, optionalUuid, text, uuid } from "@/lib/validation/common";

export async function createTask(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ title: text(200), assignee_id: optionalUuid, due_date: optionalDate }), fd);
  if (error) return error;
  return runAction(OFFICE, async ({ db, session }) => {
    const { error: e } = await db.from("tasks").insert({
      title: data.title,
      assignee_id: data.assignee_id ?? null,
      due_date: data.due_date ?? null,
      kind: "manual",
      created_by: session.userId,
    });
    return e ? dbFail(e) : done("Task added.");
  });
}

export async function setTaskStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ id: uuid, status: z.enum(["open", "in_progress", "done", "cancelled"]) }), fd);
  if (error) return error;
  return runAction(STAFF_ROLES, async ({ db }) => {
    const { error: e } = await db.from("tasks").update({ status: data.status }).eq("id", data.id);
    return e ? dbFail(e) : done("Updated.");
  });
}

export async function assignTask(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ id: uuid, assignee_id: optionalUuid, due_date: optionalDate }), fd);
  if (error) return error;
  return runAction(OFFICE, async ({ db }) => {
    const { error: e } = await db.from("tasks").update({ assignee_id: data.assignee_id ?? null, due_date: data.due_date ?? null }).eq("id", data.id);
    return e ? dbFail(e) : done("Saved.");
  });
}
