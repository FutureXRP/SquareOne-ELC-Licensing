import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * End-to-end acceptance tests (BUILD.md section 9) against the local Supabase stack:
 *   scripts/supabase-local.sh start && pnpm build && pnpm test:e2e
 * Real Auth, real PostgREST, real Storage, real RLS. Synthetic data only.
 */
function localEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(".env.supabase-local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
  } catch {
    throw new Error("Run scripts/supabase-local.sh start first (it writes .env.supabase-local).");
  }
}

const PORT = 3100;
const env = localEnv();
export const E2E = {
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  baseURL: `http://127.0.0.1:${PORT}`,
  cronSecret: "local-cron-secret-0123456789",
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: E2E.baseURL, trace: "off" },
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `${E2E.baseURL}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...env,
      NEXT_PUBLIC_APP_URL: E2E.baseURL,
      CRON_SECRET: E2E.cronSecret,
      REMINDERS_ENABLED: "true",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
    },
  },
});
