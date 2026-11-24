import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { E2E } from "../../playwright.config";

export const PASSWORD = "synthetic-password-e2e-1";
export const USERS = {
  director: { email: "director@example.test", role: "director", staff: "30000000-0000-4000-8000-000000000001", name: "Sample Alder" },
  admin: { email: "admin@example.test", role: "admin_support", staff: "30000000-0000-4000-8000-000000000002", name: "Sample Birch" },
  educator1: { email: "educator1@example.test", role: "educator", staff: "30000000-0000-4000-8000-000000000003", name: "Sample Cedar" },
  educator2: { email: "educator2@example.test", role: "educator", staff: "30000000-0000-4000-8000-000000000004", name: "Sample Dogwood" },
  auditor: { email: "auditor@example.test", role: "auditor", staff: null, name: "Synthetic Auditor" },
} as const;

/** Fresh database (migrations + synthetic seed), then one login per role. */
export default async function globalSetup() {
  if (process.env.E2E_SKIP_RESET !== "1") execFileSync("scripts/supabase-local.sh", ["reset"], { stdio: "inherit" });
  const admin = createClient(E2E.NEXT_PUBLIC_SUPABASE_URL, E2E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (const u of Object.values(USERS)) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true, app_metadata: { role: u.role, display_name: u.name } });
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
    if (u.staff) {
      const { error: e } = await admin.from("profiles").update({ staff_id: u.staff }).eq("id", data.user.id);
      if (e) throw new Error(`link staff ${u.email}: ${e.message}`);
    }
  }
}
