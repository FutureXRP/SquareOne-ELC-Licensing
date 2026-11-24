"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { DIRECTOR, runAction } from "@/lib/auth/action";
import { dbFail, done, fail, parseForm, type ActionState } from "@/lib/actions";
import { invitationEmail } from "../../emails/templates";
import { sendEmail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkbox, optionalText, optionalUuid, uuid } from "@/lib/validation/common";

const role = z.enum(["director", "admin_support", "educator", "classroom_reviewer", "auditor"]);

/**
 * Invite a person (email with a link), or create the account with a temporary password
 * when email is not set up yet. The role goes into app_metadata, which only this
 * server-side call can write, and the profile is activated with that role.
 */
export async function inviteUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    display_name: optionalText(120),
    role,
    staff_id: optionalUuid,
    temporary_password: z.string().min(12, "Use at least 12 characters.").max(72).optional(),
  });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async () => {
    const admin = createAdminClient();
    const app_metadata = { role: data.role, display_name: data.display_name ?? null };
    let userId: string;
    let inviteUrl: string | null = null;
    if (data.temporary_password) {
      const created = await admin.auth.admin.createUser({
        email: data.email,
        password: data.temporary_password,
        email_confirm: true,
        app_metadata,
      });
      if (created.error || !created.data.user) return fail(created.error?.message ?? "The account could not be created.");
      userId = created.data.user.id;
    } else {
      // A one-time invitation link that lands on this app (not Supabase's default page).
      const link = await admin.auth.admin.generateLink({ type: "invite", email: data.email });
      if (link.error || !link.data.user || !link.data.properties?.hashed_token) {
        return fail(link.error?.message ?? "The invitation could not be created.");
      }
      userId = link.data.user.id;
      // The link points at the site the director is using right now.
      const origin = (await headers()).get("origin") ?? publicEnv.appUrl ?? "";
      inviteUrl = `${origin}/auth/callback?token_hash=${link.data.properties.hashed_token}&type=invite&next=/welcome`;
      const meta = await admin.auth.admin.updateUserById(userId, { app_metadata });
      if (meta.error) return fail(meta.error.message);
    }
    // The signup trigger made the profile; set it to exactly what the director chose.
    const { error: e } = await admin
      .from("profiles")
      .update({ role: data.role, is_active: true, display_name: data.display_name ?? null, staff_id: data.staff_id ?? null })
      .eq("id", userId);
    if (e) return dbFail(e);
    if (!inviteUrl) return done("Account created. Share the temporary password privately.");
    const mailed = await sendEmail(data.email, invitationEmail({ url: inviteUrl }));
    return done(
      mailed.ok
        ? "Invitation emailed. The link works once."
        : `Email is not set up, so nothing was sent. Give this one-time link to the person privately: ${inviteUrl}`,
    );
  });
}

export async function updateUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({ id: uuid, role, is_active: checkbox, child_health_access: checkbox, staff_id: optionalUuid, display_name: optionalText(120) });
  const { data, error } = parseForm(schema, fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db, session }) => {
    if (data.id === session.userId && (data.role !== "director" || !data.is_active)) {
      return fail("You cannot remove your own director access. Ask another director.");
    }
    const { id, ...rest } = data;
    const { error: e } = await db
      .from("profiles")
      .update({ ...rest, staff_id: rest.staff_id ?? null, display_name: rest.display_name ?? null })
      .eq("id", id);
    if (e) return dbFail(e);
    // Keep the token's metadata in step and end sessions for a deactivated account.
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(id, { app_metadata: { role: data.role }, ban_duration: data.is_active ? "none" : "876000h" });
    return done("User saved.");
  });
}

export async function assignReviewerClassroom(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { data, error } = parseForm(z.object({ profile_id: uuid, classroom_id: uuid }), fd);
  if (error) return error;
  return runAction(DIRECTOR, async ({ db }) => {
    const { error: e } = await db.from("classroom_reviewer_assignments").insert(data);
    return e ? dbFail(e) : done("Classroom assigned.");
  });
}
