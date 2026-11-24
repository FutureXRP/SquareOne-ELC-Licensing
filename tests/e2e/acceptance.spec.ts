import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { E2E } from "../../playwright.config";
import { PASSWORD, USERS } from "./global-setup";

/**
 * MVP acceptance tests (BUILD.md section 9), run in order against one fresh database.
 * Every step goes through the real app with a real login; checks that the UI cannot show
 * (storage denial, row counts) use the same user's own Supabase session.
 */
test.describe.configure({ mode: "serial" });

const admin = createClient(E2E.NEXT_PUBLIC_SUPABASE_URL, E2E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CPR = "Staff first aid and CPR certification on file";
const STAFF = { cedar: USERS.educator1.staff, dogwood: USERS.educator2.staff, elm: "30000000-0000-4000-8000-000000000005", fir: "30000000-0000-4000-8000-000000000006" };

const iso = (offsetDays: number) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
};

async function signIn(page: Page, who: keyof typeof USERS) {
  await page.goto("/login");
  await page.locator("#email").fill(USERS[who].email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  page.on("dialog", (d) => d.accept());
}

async function asUser(who: keyof typeof USERS): Promise<SupabaseClient> {
  const client = createClient(E2E.NEXT_PUBLIC_SUPABASE_URL, E2E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: USERS[who].email, password: PASSWORD });
  if (error) throw error;
  return client;
}

const section = (page: Page, title: string | RegExp) => page.locator("section").filter({ has: page.getByRole("heading", { name: title }) });
const card = (page: Page, label: string) => page.getByRole("link").filter({ hasText: label });

async function cprItem(staffId: string, open = true) {
  let q = admin.from("v_requirement_status").select("*").eq("requirement_code", "DHS-STAFF-003").eq("subject_id", staffId);
  if (open) q = q.is("closed_at", null);
  const { data } = await q.order("cycle_number", { ascending: false }).limit(1).single();
  return data!;
}

async function upload(page: Page, itemId: string, fileName: string, expiry: string) {
  await page.goto(`/items/${itemId}`);
  const form = section(page, "Upload evidence");
  await form.locator('[name="file"]:not([type="hidden"])').setInputFiles({ name: fileName, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4 synthetic ${fileName}`) });
  await form.locator('[name="doc_type"]:not([type="hidden"])').fill("Certificate");
  await form.locator('[name="expiry_date"]:not([type="hidden"])').fill(expiry);
  await form.getByRole("button", { name: "Upload for review" }).click();
  await expect(form.getByRole("status")).toHaveText("Uploaded. It is waiting for review.");
}

async function decide(page: Page, decision: "Approve" | "Return for correction", note?: string) {
  await page.goto("/review");
  const box = section(page, new RegExp(CPR)).first();
  if (note) await box.locator('[name="correction_note"]:not([type="hidden"])').fill(note);
  await box.getByRole("button", { name: decision }).click();
  // Once decided, the submission leaves the queue.
  await expect(page.getByText("Nothing is waiting for review.")).toBeVisible();
}

test("unknown requirements stay visible and do not raise readiness; activation needs a confirmed source", async ({ page }) => {
  await signIn(page, "director");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(card(page, "Unknown (source not confirmed)")).toContainText("117");
  await expect(card(page, "Requirements verified")).toContainText("0 of 117");
  await expect(page.getByText("Not an official compliance determination").first()).toBeVisible();

  await page.goto("/requirements");
  await page.getByRole("link", { name: CPR }).click();
  const draft = section(page, /^Draft/);
  await draft.getByRole("button", { name: "Activate this version" }).click();
  await expect(draft.getByRole("alert")).toContainText("Activation needs the citation");

  await draft.locator('[name="citation"]:not([type="hidden"])').fill("Synthetic citation 1");
  await draft.locator('[name="source_url"]:not([type="hidden"])').fill("https://example.test/synthetic-rule");
  await draft.locator('[name="last_source_review"]:not([type="hidden"])').fill(iso(0));
  await draft.locator('[name="frequency"]:not([type="hidden"])').selectOption("expiration_based");
  await draft.locator('[name="criticality"]:not([type="hidden"])').selectOption("regulatory");
  await draft.locator('[name="rule_type"]:not([type="hidden"])').selectOption("expiration");
  await draft.getByRole("button", { name: "Save draft" }).click();
  await expect(draft.getByRole("status")).toHaveText("Draft saved.");
  await page.reload();
  await section(page, /^Draft/).getByRole("button", { name: "Activate this version" }).click();
  await expect(section(page, "Versions").getByText("active", { exact: true })).toBeVisible();

  // Activating one requirement moves only its 12 staff items out of "unknown"; none are verified by it.
  await page.goto("/");
  await expect(card(page, "Unknown (source not confirmed)")).toContainText("105");
  await expect(card(page, "Missing evidence")).toContainText("12");
  await expect(card(page, "Requirements verified")).toContainText("0 of 117");
});

test("uploading evidence does not close a requirement", async ({ page }) => {
  await signIn(page, "educator1");
  await page.goto("/staff");
  await expect(page.getByRole("link", { name: "Sample Cedar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sample Dogwood" })).toHaveCount(0);

  const item = await cprItem(STAFF.cedar);
  await upload(page, item.requirement_instance_id, "cpr-first.pdf", iso(400));
  await page.reload();
  await expect(section(page, "Status").getByText("Awaiting review")).toBeVisible();
  await expect(section(page, "Status").getByText("Verified", { exact: true })).toHaveCount(0);
  const after = await cprItem(STAFF.cedar);
  expect(after.evidence_status).toBe("pending_review");
  expect(after.is_green).toBe(false);
});

test("a staff member cannot read another staff member's documents (table and storage)", async ({ page }) => {
  const { data: ev } = await admin.from("evidence").select("id, storage_path").eq("file_name", "cpr-first.pdf").single();

  const owner = await asUser("educator1");
  expect((await owner.from("evidence").select("id")).data).toHaveLength(1);
  expect((await owner.storage.from("evidence").download(ev!.storage_path)).error).toBeNull();

  const other = await asUser("educator2");
  expect((await other.from("evidence").select("id")).data).toHaveLength(0);
  expect((await other.from("evidence_links").select("id")).data).toHaveLength(0);
  expect((await other.storage.from("evidence").download(ev!.storage_path)).error).not.toBeNull();
  expect((await other.storage.from("evidence").createSignedUrl(ev!.storage_path, 60)).error).not.toBeNull();
  expect((await other.from("credentials").select("staff_id")).data!.every((c) => c.staff_id === STAFF.dogwood)).toBe(true);

  await signIn(page, "educator2");
  expect((await page.request.get(`/api/evidence/signed-url?id=${ev!.id}`, { maxRedirects: 0 })).status()).toBe(404);
  await signOutAndIn(page, "educator1");
  const mine = await page.request.get(`/api/evidence/signed-url?id=${ev!.id}`, { maxRedirects: 0 });
  expect(mine.status()).toBe(307);
  expect(mine.headers().location).toContain("/storage/v1/object/sign/evidence/");
  // The successful view is logged with who and what; the refused one left no trace.
  const { data: views } = await admin.from("evidence_access_log").select("evidence_id, profile_id");
  const { data: cedar } = await admin.from("profiles").select("id").eq("email", USERS.educator1.email).single();
  expect(views).toEqual([{ evidence_id: ev!.id, profile_id: cedar!.id }]);
});

async function signOutAndIn(page: Page, who: keyof typeof USERS) {
  await page.context().clearCookies();
  await signIn(page, who);
}

test("a rejected submission returns to its owner with a correction task", async ({ page }) => {
  await signIn(page, "director");
  await decide(page, "Return for correction", "Synthetic note: the copy is unreadable.");

  await signOutAndIn(page, "educator1");
  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: `Correct and resubmit: ${CPR}` })).toBeVisible();
  const item = await cprItem(STAFF.cedar);
  expect(item.evidence_status).toBe("needs_correction");
  await page.goto(`/items/${item.requirement_instance_id}`);
  await expect(section(page, "Status").getByText("Needs correction")).toBeVisible();
  await expect(page.getByText("Synthetic note: the copy is unreadable.")).toBeVisible();

  const { data: notices } = await admin.from("reminder_events").select("milestone, status").eq("requirement_instance_id", item.requirement_instance_id);
  expect(notices).toEqual([{ milestone: "rejected", status: "queued" }]);
});

test("an approved renewal keeps prior evidence and sets the correct next deadline", async ({ page }) => {
  const first = await cprItem(STAFF.cedar);
  await signIn(page, "educator1");
  await upload(page, first.requirement_instance_id, "cpr-corrected.pdf", iso(200));
  expect((await cprItem(STAFF.cedar)).evidence_status).toBe("pending_review");

  await signOutAndIn(page, "director");
  await decide(page, "Approve");
  const verified = await cprItem(STAFF.cedar);
  expect(verified.requirement_instance_id).toBe(first.requirement_instance_id);
  expect(verified.evidence_status).toBe("verified");
  expect(verified.due_date).toBe(iso(200)); // the document's own expiry, not the upload date
  expect(verified.is_green).toBe(true);
  const { data: tasks } = await admin.from("tasks").select("status").eq("requirement_instance_id", first.requirement_instance_id).eq("kind", "correction");
  expect(tasks).toEqual([{ status: "done" }]);

  // Renewal: new evidence with a later expiry.
  await signOutAndIn(page, "educator1");
  await upload(page, first.requirement_instance_id, "cpr-renewal.pdf", iso(565));
  await signOutAndIn(page, "director");
  await decide(page, "Approve");

  const next = await cprItem(STAFF.cedar);
  expect(next.requirement_instance_id).not.toBe(first.requirement_instance_id);
  expect(next.cycle_number).toBe(2);
  expect(next.due_date).toBe(iso(565));
  expect(next.evidence_status).toBe("verified");
  const { data: prior } = await admin.from("requirement_instances").select("closed_at").eq("id", first.requirement_instance_id).single();
  expect(prior!.closed_at).not.toBeNull();
  const { data: oldLinks } = await admin.from("evidence_links").select("status").eq("requirement_instance_id", first.requirement_instance_id).order("created_at");
  expect(oldLinks!.map((l) => l.status)).toEqual(["rejected", "approved"]); // prior evidence stays with its cycle
  const { data: newLinks } = await admin.from("evidence_links").select("status").eq("requirement_instance_id", next.requirement_instance_id);
  expect(newLinks).toEqual([{ status: "approved" }]);

  await page.goto(`/items/${next.requirement_instance_id}`);
  await expect(page.getByText("cycle 2")).toBeVisible();
  await page.getByRole("link", { name: "Previous cycle and its evidence" }).click();
  await expect(page.getByText("cpr-corrected.pdf")).toBeVisible();
  await expect(page.getByText("Closed cycle (history)")).toBeVisible();
});

test("an expired credential cannot display as verified or current", async ({ page }) => {
  await signIn(page, "director");
  await page.goto(`/staff/${STAFF.elm}`);
  const creds = section(page, "Credentials");
  await creds.locator('[name="credential_type_id"]:not([type="hidden"])').selectOption({ label: "Food handler permit" });
  await creds.locator('[name="issue_date"]:not([type="hidden"])').fill(iso(-400));
  await creds.locator('[name="expiration_date"]:not([type="hidden"])').fill(iso(-1));
  await creds.getByRole("button", { name: "Record credential" }).click();
  await expect(creds.getByRole("status")).toContainText("Credential recorded");
  const row = creds.getByRole("row").filter({ hasText: "Food handler permit" });
  await row.getByRole("button", { name: "Verify" }).click();
  await expect(row.getByText(/^Verified \d/)).toBeVisible(); // the review is recorded...
  await expect(row.getByText("Expired", { exact: true })).toBeVisible(); // ...but the standing is Expired
  await expect(row.getByText("Verified", { exact: true })).toHaveCount(0);

  const { data } = await admin.from("v_credentials").select("is_verified_current, deadline_status, verified_at").eq("staff_id", STAFF.elm).eq("credential_name", "Food handler permit").single();
  expect(data!.verified_at).not.toBeNull();
  expect(data).toMatchObject({ is_verified_current: false, deadline_status: "overdue" });
});

test("a credential due in 30 days is in the Due in 30 days queue and produces exactly one notice; a failed delivery is logged and visible", async ({ page }) => {
  await signIn(page, "director");
  await page.goto(`/staff/${STAFF.fir}`);
  const creds = section(page, "Credentials");
  await creds.locator('[name="credential_type_id"]:not([type="hidden"])').selectOption({ label: "Educator credential" });
  await creds.locator('[name="expiration_date"]:not([type="hidden"])').fill(iso(30));
  await creds.getByRole("button", { name: "Record credential" }).click();
  await expect(creds.getByRole("status")).toContainText("Credential recorded");
  const { data: cred } = await admin.from("credentials").select("id").eq("staff_id", STAFF.fir).eq("expiration_date", iso(30)).single();

  await page.goto("/calendar");
  await expect(section(page, /^Next 30 days/).getByRole("row").filter({ hasText: "Educator credential" })).toContainText("Sample Fir");

  expect((await page.request.get("/api/cron/daily")).status()).toBe(401);
  const auth = { headers: { authorization: `Bearer ${E2E.cronSecret}` } };
  const run = await (await page.request.get("/api/cron/daily", auth)).json();
  expect(run.planned).toBeGreaterThan(0);
  expect((await (await page.request.get("/api/cron/daily", auth)).json()).skipped).toBe("already ran today");
  // Force a second full run on the same day: still exactly one notice for this credential.
  await admin.from("settings").update({ value: "never" }).eq("key", "cron_daily_last_run");
  const again = await (await page.request.get("/api/cron/daily", auth)).json();
  expect(again.planned).toBe(0);
  const { data: notices } = await admin.from("reminder_events").select("milestone, status, attempts, last_error").eq("credential_id", cred!.id);
  expect(notices).toHaveLength(1);
  expect(notices![0]).toMatchObject({ milestone: "d30", status: "failed" });
  expect(notices![0].last_error).toContain("not configured");

  for (const who of ["director", "admin"] as const) {
    await signOutAndIn(page, who);
    await page.goto("/settings/notifications");
    await expect(section(page, /^Failed deliveries \([1-9]/)).toContainText("Email is not configured");
  }
});

test("duplicate training records do not increase verified minutes; CSV import flags duplicates", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto(`/staff/${STAFF.elm}`);
  const ledger = section(page, "Training ledger");
  const add = async (title: string) => {
    await ledger.locator('[name="course_title"]:not([type="hidden"])').fill(title);
    await ledger.locator('[name="completion_date"]:not([type="hidden"])').fill("2026-05-01");
    await ledger.locator('[name="hours"]:not([type="hidden"])').fill("2");
    await ledger.getByRole("button", { name: "Record training" }).click();
  };
  await add("Synthetic course B");
  await expect(ledger.getByRole("status")).toContainText("recorded as pending");
  await add("SYNTHETIC COURSE B");
  await expect(ledger.getByRole("alert")).toContainText("already on file");

  await page.goto("/settings/import");
  await page.locator('[name="kind"]:not([type="hidden"])').selectOption("training");
  await page.locator('[name="csv"]:not([type="hidden"])').fill("employee_code,course_title,completion_date,minutes\nSYN-005,synthetic course b,2026-05-01,120\nSYN-005,Synthetic course C,2026-06-01,45\nSYN-005,Bad row,2026-06-02,1.5\n");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("status")).toContainText("1 of 3 rows are ready");
  await expect(page.getByText("Already on file.")).toBeVisible();
  await page.getByRole("button", { name: "Import 1 ready row" }).click();
  await expect(page.getByRole("status")).toContainText("Imported 1 row");

  await signOutAndIn(page, "director");
  await page.goto(`/staff/${STAFF.elm}`);
  const row = section(page, "Training ledger").getByRole("row").filter({ hasText: "Synthetic course B" });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(section(page, "Training ledger").getByText("Verified: 2 h")).toBeVisible();
  const { data } = await admin.from("training_records").select("minutes, state").eq("staff_id", STAFF.elm);
  expect(data!.filter((r) => r.state === "verified").reduce((n, r) => n + r.minutes, 0)).toBe(120);
  expect(data!.map((r) => r.minutes).sort((a, b) => a - b)).toEqual([45, 120, 120]); // seed course A, course B once, course C
});

test("a quarterly review keeps a dated snapshot and open follow-ups", async ({ page }) => {
  await signIn(page, "director");
  await page.goto("/settings/reviews");
  await section(page, "Open a review").getByRole("button", { name: "Open review" }).click();
  await page.getByRole("button", { name: "Sign off and save snapshot" }).click();
  await expect(page.getByText(/^Signed off .* by Sample Alder/)).toBeVisible();
  await expect(page.getByText(/Snapshot taken \d{4}-\d{2}-\d{2}: readiness/)).toBeVisible();

  const { data: result } = await admin.from("review_results").select("*").single();
  expect((result!.snapshot as { taken_on: string }).taken_on).toBe(iso(0));
  expect((result!.exceptions as unknown[]).length).toBeGreaterThan(0);
  expect(result!.follow_up_task_ids.length).toBeGreaterThan(0);
  const { data: followUp } = await admin.from("tasks").select("title, status").in("id", result!.follow_up_task_ids).like("title", "Q%review%").single();
  expect(followUp!.status).toBe("open");
  // The snapshot and the signed-off cycle are immutable, even for the service role.
  expect((await admin.from("review_results").update({ scope: "edited" }).eq("id", result!.id)).error).not.toBeNull();
  expect((await admin.from("review_cycles").update({ quarter: 1 }).eq("id", result!.cycle_id)).error).not.toBeNull();
});

test("a child-file export excludes unrelated sensitive records", async ({ page }) => {
  // Off by default: the database refuses child records until a director turns them on.
  expect((await admin.from("children").insert({ child_code: "CH-000", first_name: "Sample", last_initial: "Z" })).error).not.toBeNull();

  await signIn(page, "director");
  await page.goto("/settings");
  const toggle = section(page, "Child records");
  await toggle.getByRole("checkbox").check();
  await toggle.getByRole("button", { name: "Save" }).click();
  await expect(toggle.getByRole("status")).toHaveText("Child records are on.");

  const { data: director } = await admin.from("profiles").select("id").eq("email", USERS.director.email).single();
  const { error } = await admin.from("requirement_versions").update({ status: "active", citation: "Synthetic citation 2", source_url: "https://example.test/child", last_source_review: iso(0), reviewed_by: director!.id, frequency: "one_time", criticality: "regulatory" }).eq("id", "60000000-0000-4000-8000-000000000009");
  expect(error).toBeNull();

  await page.goto("/files/children");
  const form = section(page, "Add a child");
  await form.locator('[name="child_code"]:not([type="hidden"])').fill("CH-001");
  await form.locator('[name="first_name"]:not([type="hidden"])').fill("Sample");
  await form.locator('[name="last_initial"]:not([type="hidden"])').fill("q");
  await form.getByRole("button", { name: "Add child" }).click();
  await expect(form.getByRole("status")).toContainText("Child added");

  const csv = await (await page.request.get("/api/export/child-files")).text();
  expect(csv).toContain("Sample Q.");
  expect(csv).toContain("Child enrollment file checklist complete");
  for (const leak of ["Cedar", "Dogwood", "cpr-", "Food handler", "SYN-0", "example.test", "Staff first aid"]) expect(csv).not.toContain(leak);
  // An educator's export of the same report holds nothing: children are not visible to them.
  await signOutAndIn(page, "educator1");
  expect(await (await page.request.get("/api/export/child-files")).text()).not.toContain("Sample Q.");
});

test("an auditor sees only a scoped, time-limited packet", async ({ page }) => {
  await signIn(page, "director");
  await page.goto("/settings/auditors");
  const grant = section(page, "Grant a packet");
  await grant.locator('[name="authority"]:not([type="hidden"])').selectOption("DHS");
  await grant.locator('[name="label"]:not([type="hidden"])').fill("Synthetic licensing visit");
  await grant.getByRole("button", { name: "Grant packet" }).click();
  await expect(grant.getByRole("status")).toContainText("Packet granted for 3 days");

  await signOutAndIn(page, "auditor");
  await expect(page).toHaveURL(/\/packet$/);
  await page.getByRole("link", { name: "Synthetic licensing visit" }).click();
  await expect(page.getByText(CPR).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "cpr-renewal.pdf" })).toBeVisible();
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/no-access$/);

  const auditor = await asUser("auditor");
  expect((await auditor.from("staff").select("id")).data).toHaveLength(0);
  expect((await auditor.from("credentials").select("id")).data).toHaveLength(0);
  const visible = (await auditor.from("evidence").select("file_name")).data!.map((e) => e.file_name).sort();
  expect(visible).toEqual(["cpr-corrected.pdf", "cpr-renewal.pdf"]); // approved only; the rejected upload is not in scope
  expect((await auditor.from("requirements").select("code")).data!.every((r) => r.code.startsWith("DHS-"))).toBe(true);
  expect((await auditor.from("evidence").update({ doc_type: "x" }).neq("doc_type", "x").select("id")).data ?? []).toHaveLength(0);

  await admin.from("auditor_grants").update({ revoked_at: new Date().toISOString() }).eq("label", "Synthetic licensing visit");
  expect((await auditor.from("evidence").select("id")).data).toHaveLength(0);
  expect((await auditor.from("requirements").select("id")).data).toHaveLength(0);
});

test("a new account from the Users screen can sign in; a separated staff member cannot see anything", async ({ page }) => {
  await signIn(page, "director");
  await page.goto("/settings/users");
  const invite = section(page, "Invite someone");
  await invite.locator('[name="email"]:not([type="hidden"])').fill("newhire@example.test");
  await invite.locator('[name="display_name"]:not([type="hidden"])').fill("Sample Elm");
  await invite.locator('[name="role"]:not([type="hidden"])').selectOption("educator");
  await invite.locator('[name="staff_id"]:not([type="hidden"])').selectOption({ label: "Sample Elm (SYN-005)" });
  await invite.locator('[name="temporary_password"]:not([type="hidden"])').fill("synthetic-temp-pass-9");
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(invite.getByRole("status")).toContainText("Account created");

  // Invitation link: lands signed in on the welcome page, where the person sets a password.
  await invite.locator('[name="email"]:not([type="hidden"])').fill("invited@example.test");
  await invite.locator('[name="role"]:not([type="hidden"])').selectOption("admin_support");
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(invite.getByRole("status")).toContainText("one-time link");
  const link = (await invite.getByRole("status").innerText()).match(/http\S+/)![0];
  const fresh = await page.context().browser()!.newContext();
  const guest = await fresh.newPage();
  await guest.goto(link);
  await expect(guest).toHaveURL(/\/welcome$/);
  await guest.locator('[name="password"]').fill("synthetic-invited-pass-7");
  await guest.locator('[name="confirm"]').fill("synthetic-invited-pass-7");
  await guest.getByRole("button", { name: "Save password" }).click();
  await expect(guest.getByRole("status")).toContainText("Password saved");
  await guest.goto("/staff");
  await expect(guest.getByRole("link", { name: "Sample Cedar" })).toBeVisible(); // admin support sees the roster
  await guest.goto(link); // the link cannot be used twice
  await fresh.clearCookies();
  await guest.goto(link);
  await expect(guest).toHaveURL(/\/login$/);
  await fresh.close();

  await page.goto(`/staff/${STAFF.dogwood}`);
  const record = section(page, "Staff record");
  await record.locator('[name="employment_status"]:not([type="hidden"])').selectOption("separated");
  await record.locator('[name="separation_date"]:not([type="hidden"])').fill(iso(0));
  await record.getByRole("button", { name: "Save record" }).click();
  await expect(record.getByRole("status")).toContainText("Their login is off");

  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator("#email").fill("newhire@example.test");
  await page.locator("#password").fill("synthetic-temp-pass-9");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.goto("/staff");
  await expect(page.getByRole("link", { name: "Sample Elm" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sample Cedar" })).toHaveCount(0);

  await signOutAndIn(page, "educator2");
  await expect(page.getByText("Your account is not active")).toBeVisible();
  const gone = await asUser("educator2");
  expect((await gone.from("credentials").select("id")).data).toHaveLength(0);
  expect((await admin.from("credentials").select("id").eq("staff_id", STAFF.dogwood)).data!.length).toBeGreaterThan(0); // records kept
});
