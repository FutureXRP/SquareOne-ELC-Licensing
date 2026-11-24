import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";

/** Result of a server action, shown by <ActionForm>. */
export type ActionState = { ok: boolean; message: string | null };

export const IDLE: ActionState = { ok: false, message: null };
export const done = (message: string): ActionState => ({ ok: true, message });
export const fail = (message: string): ActionState => ({ ok: false, message });

/** FormData to a plain object; empty strings become undefined so optional fields validate. */
export function formObject(formData: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    out[key] = trimmed === "" ? undefined : trimmed;
  }
  return out;
}

export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { data: z.infer<T>; error: null } | { data: null; error: ActionState } {
  const parsed = schema.safeParse(formObject(formData));
  if (parsed.success) return { data: parsed.data, error: null };
  const issue = parsed.error.issues[0];
  const field = issue?.path.join(".") ?? "";
  return { data: null, error: fail(field ? `${field}: ${issue?.message}` : (issue?.message ?? "Check the form.")) };
}

/** Database errors in plain words. The database's own rule messages are written for people. */
export function dbFail(error: PostgrestError | { message: string; code?: string }): ActionState {
  const code = "code" in error ? error.code : undefined;
  if (code === "23505") return fail("That already exists (duplicate).");
  if (code === "42501" && /row-level security/i.test(error.message)) return fail("You do not have permission to do that.");
  if (code === "23503") return fail("That refers to a record that does not exist.");
  if (code === "P0001" || code === "23514" || code === "42501" || code === "22023") return fail(sentence(error.message));
  return fail("That could not be saved. Nothing was changed.");
}

function sentence(text: string): string {
  const t = text.trim();
  return t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".");
}
