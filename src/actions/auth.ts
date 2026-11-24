"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { done, fail, type ActionState } from "@/lib/actions";
import { signInSchema } from "@/lib/validation/auth";

export type SignInState = { error: string | null; email: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  if (!isSupabaseConfigured()) {
    return { error: "Sign-in is not configured for this deployment yet.", email };
  }

  const parsed = signInSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your email and password.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.status === undefined || error.status === 0 || error.status >= 500) {
      return { error: "The sign-in service could not be reached. Try again in a moment.", email };
    }
    // One message for every failure, so the form does not reveal which accounts exist.
    return { error: "That email and password did not match an account.", email };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

/** Invited users arrive signed in through their email link and choose a password here. */
export async function setPassword(_p: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 12) return fail("Use at least 12 characters.");
  if (password !== String(formData.get("confirm") ?? "")) return fail("The two passwords do not match.");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error.status === 422 ? "Choose a different password." : "The password could not be saved. Open your invitation link again.");
  return done("Password saved. You can use the menu above to get started.");
}
