import type { Enums } from "@/lib/database.types";

export type AppRole = Enums<"app_role">;

/**
 * What each role may do (BUILD.md section 6).
 *
 * This table drives navigation and early "not allowed" responses only. It is NOT the
 * access control: Row Level Security in supabase/migrations/0009_rls_policies.sql is.
 * Keep the two in step; when they disagree, the database wins.
 */
export const PERMISSIONS = {
  "settings.manage": ["director"],
  "users.manage": ["director"],
  "library.activate": ["director"],
  "library.edit": ["director"],
  "evidence.review": ["director"],
  "na.approve": ["director"],
  "audit.read": ["director"],
  "staff.read_all": ["director", "admin_support"],
  "staff.edit": ["director", "admin_support"],
  "tasks.manage": ["director", "admin_support"],
  "notifications.read": ["director", "admin_support"],
  "evidence.upload_own": ["director", "admin_support", "educator", "classroom_reviewer"],
  "overview.read": ["director", "admin_support", "educator", "classroom_reviewer"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly AppRole[]).includes(role);
}

export const ROLE_LABEL: Record<AppRole, string> = {
  director: "Director",
  admin_support: "Admin support",
  educator: "Educator",
  classroom_reviewer: "Classroom reviewer",
  auditor: "Auditor",
};
