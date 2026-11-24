import "server-only";
import { revalidatePath } from "next/cache";
import type { AppRole } from "@/lib/auth/permissions";
import { getSession, type Session } from "@/lib/auth/session";
import { fail, type ActionState } from "@/lib/actions";
import type { Db } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type Ctx = { session: Session & { role: AppRole }; db: Db };

/**
 * Wrap a server action: re-check the session and role next to the data, hand the action a
 * client that carries the user's session (so RLS applies), and refresh the screens after.
 * The role list is an early, friendly refusal. The database is still the access control.
 */
export async function runAction(
  roles: readonly AppRole[],
  work: (ctx: Ctx) => Promise<ActionState>,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role === null) return fail("Your session has ended. Sign in again.");
  if (!roles.includes(session.role)) return fail("You do not have permission to do that.");
  const db = await createClient();
  const result = await work({ session: session as Ctx["session"], db });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export const OFFICE: readonly AppRole[] = ["director", "admin_support"];
export const DIRECTOR: readonly AppRole[] = ["director"];
export const STAFF_ROLES: readonly AppRole[] = ["director", "admin_support", "educator", "classroom_reviewer"];
