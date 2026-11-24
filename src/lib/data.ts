import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/domain/status";

export type Db = SupabaseClient<Database>;

/** Read every row of a query, paging past the API's row limit. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error || !data) throw new Error("Records could not be loaded.");
    out.push(...data);
    if (data.length < size) return out;
  }
}

export async function getSettings(db: Db): Promise<Record<string, unknown>> {
  const { data } = await db.from("settings").select("key, value").is("archived_at", null);
  return Object.fromEntries((data ?? []).map((s) => [s.key, s.value]));
}

export async function getThresholds(db: Db): Promise<Thresholds> {
  const s = await getSettings(db);
  const int = (v: unknown, fallback: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : fallback);
  return {
    urgentDays: int(s.urgent_days, DEFAULT_THRESHOLDS.urgentDays),
    dueSoonDays: int(s.due_soon_days, DEFAULT_THRESHOLDS.dueSoonDays),
  };
}

/** id -> display name for the given profile ids (works for every staff role). */
export async function profileNames(db: Db, ids: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  if (unique.length === 0) return new Map();
  const { data } = await db.rpc("profile_names", { ids: unique });
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

export async function listClassrooms(db: Db) {
  const { data } = await db.from("classrooms").select("id, name").is("archived_at", null).order("name");
  return data ?? [];
}

export async function listStaff(db: Db) {
  const { data } = await db
    .from("staff")
    .select("id, employee_code, first_name, last_name, role_title, classroom_id, employment_status, hire_date, pdl_level, pdl_renewal_date")
    .is("archived_at", null)
    .order("last_name");
  return data ?? [];
}

export async function listProfiles(db: Db) {
  const { data } = await db
    .from("profiles")
    .select("id, email, display_name, role, is_active, staff_id, child_health_access, can_draft_library")
    .is("archived_at", null)
    .order("email");
  return data ?? [];
}

export const personLabel = (p: { display_name: string | null; email: string }) => p.display_name || p.email;
