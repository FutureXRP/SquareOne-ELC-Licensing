// Create (or re-activate) a director login for a development or preview Supabase project.
//
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   SEED_DIRECTOR_EMAIL=director@example.test SEED_DIRECTOR_PASSWORD='...' pnpm seed:director
//
// Synthetic data only (rule 10): use a test mailbox, never a real staff account.
// The password is read from the environment and is never written to the repository.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_DIRECTOR_EMAIL;
const password = process.env.SEED_DIRECTOR_PASSWORD;

if (!url || !serviceRoleKey || !email || !password) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_DIRECTOR_EMAIL and SEED_DIRECTOR_PASSWORD.",
  );
  process.exit(1);
}
if (password.length < 12) {
  console.error("SEED_DIRECTOR_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

// The role lives in app_metadata, which only the service role can write. The
// handle_new_user trigger reads it and creates an active director profile.
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: "director", display_name: "Synthetic Director" },
});

if (error) {
  console.error(`Could not create the user: ${error.message}`);
  process.exit(1);
}

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("role, is_active")
  .eq("id", data.user.id)
  .single();

if (profileError || profile.role !== "director" || !profile.is_active) {
  console.error("The user was created but its director profile is missing. Check that migrations are applied.");
  process.exit(1);
}
console.log(`Director created on ${new URL(url).host}. Sign in at /login.`);
