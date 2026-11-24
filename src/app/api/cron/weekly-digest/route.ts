import { NextResponse, type NextRequest } from "next/server";
import { weeklyDigestEmail } from "../../../../../emails/templates";
import { appUrl, cronAuthorized, getMarker, remindersEnabled, setMarker } from "@/lib/cron";
import { fetchAll } from "@/lib/data";
import { APP_TIMEZONE, chicagoToday } from "@/lib/dates";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Weekly digest: one consolidated email per person for routine items (due within 30 days
 * or overdue). Scheduled daily; it only acts on the director's chosen digest day, once.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!remindersEnabled()) return NextResponse.json({ skipped: "REMINDERS_ENABLED is not true" });

  const db = createAdminClient();
  const today = chicagoToday();
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: APP_TIMEZONE }).format(new Date()).toLowerCase();
  const { data: daySetting } = await db.from("settings").select("value").eq("key", "digest_day").maybeSingle();
  const digestDay = typeof daySetting?.value === "string" ? daySetting.value.toLowerCase() : "monday";
  if (weekday !== digestDay) return NextResponse.json({ skipped: `digest day is ${digestDay}` });
  if ((await getMarker(db, "cron_digest_last_run")) === today) return NextResponse.json({ skipped: "already ran today", date: today });

  const [items, profiles] = await Promise.all([
    fetchAll((a, b) => db.from("v_deadline_items").select("*").in("deadline_status", ["overdue", "urgent", "due_soon"]).order("due_date").range(a, b)),
    fetchAll((a, b) => db.from("profiles").select("id, email, role, is_active, staff_id").eq("is_active", true).is("archived_at", null).range(a, b)),
  ]);
  const byStaff = new Map(profiles.filter((p) => p.staff_id).map((p) => [p.staff_id!, p.id]));
  let sent = 0;
  let failed = 0;
  for (const person of profiles) {
    if (person.role === "auditor") continue;
    const mine = items.filter((i) => {
      const owner = i.owner_id ?? (i.kind === "credential" ? (byStaff.get(i.subject_id!) ?? null) : null);
      return owner === person.id || (person.role === "director" && (owner === null || i.deadline_status === "overdue"));
    });
    if (mine.length === 0) continue;
    const { data: logged } = await db
      .from("reminder_events")
      .upsert({ milestone: "d30", recipient_id: person.id, due_date: today, channel: "digest" }, { onConflict: "requirement_instance_id,credential_id,milestone,recipient_id,due_date,notice_date", ignoreDuplicates: true })
      .select("id");
    if (!logged || logged.length === 0) continue; // already sent today
    const result = await sendEmail(
      person.email,
      weeklyDigestEmail({ url: `${appUrl()}/items?view=action`, items: mine.slice(0, 50).map((i) => ({ title: i.subject_label ? `${i.title} (${i.subject_label})` : i.title!, dueDate: i.due_date!, overdue: i.deadline_status === "overdue" })) }),
    );
    if (result.ok) sent += 1;
    else failed += 1;
    await db
      .from("reminder_events")
      .update(result.ok ? { status: "sent", attempts: 1, provider_message_id: result.id, sent_at: new Date().toISOString() } : { status: "failed", attempts: 1, last_error: result.error })
      .eq("id", logged[0].id);
  }
  await setMarker(db, "cron_digest_last_run", today);
  return NextResponse.json({ date: today, sent, failed });
}
