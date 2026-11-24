import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { can, type AppRole, type Permission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Session = {
  userId: string;
  email: string;
  displayName: string | null;
  /** Null when the profile is missing, inactive or archived: the user has no access. */
  role: AppRole | null;
  staffId: string | null;
};

/**
 * The signed-in user and their profile, or null when signed out.
 * Uses getUser(), which verifies the token with the Supabase Auth server.
 * Cached per request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  // Always a request-time read: signed-in content is never prerendered or prefetched from
  // a cached shell, and clock reads after this point are allowed by Cache Components.
  await connection();
  await cookies();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, staff_id, is_active, archived_at")
    .eq("id", user.id)
    .maybeSingle();

  const active = profile !== null && profile.is_active && profile.archived_at === null;
  return {
    userId: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? null,
    role: active ? profile.role : null,
    staffId: active ? profile.staff_id : null,
  };
});

/** Signed-in user or a redirect to /login. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Signed-in user with an active profile and one of the given roles. */
export async function requireRole(...roles: AppRole[]): Promise<Session & { role: AppRole }> {
  const session = await requireSession();
  if (session.role === null) redirect("/no-access");
  if (roles.length > 0 && !roles.includes(session.role)) redirect("/no-access");
  return session as Session & { role: AppRole };
}

export async function requirePermission(permission: Permission): Promise<Session & { role: AppRole }> {
  const session = await requireSession();
  if (!can(session.role, permission)) redirect("/no-access");
  return session as Session & { role: AppRole };
}
