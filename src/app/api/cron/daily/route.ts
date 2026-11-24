import { NextResponse, type NextRequest } from "next/server";
import { criticalAlertEmail, evidenceRejectedEmail, reminderEmail } from "../../../../../emails/templates";
import { appUrl, cronAuthorized, getMarker, remindersEnabled, setMarker } from "@/lib/cron";
import { fetchAll } from "@/lib/data";
import { chicagoToday } from "@/lib/dates";
import { ALL_MILESTONES, MILESTONE_LABEL, planReminders, reminderKey, type ReminderItem } from "@/lib/domain/reminders";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 5;
const ALL = ALL_MILESTONES;

/**
 * Daily reminder run (BUILD.md section 7). Vercel Cron fires in UTC; this works out the
 * Chicago date itself and does nothing if it already ran for that date. Uses the service
 * role (allowed for cron routes, rule 6) and logs every send attempt.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!remindersEnabled()) return NextResponse.json({ skipped: "REMINDERS_ENABLED is not true" });

  const db = createAdminClient();
  const today = chicagoToday();
  if ((await getMarker(db, "cron_daily_last_run")) === today) return NextResponse.json({ skipped: "already ran today", date: today });

  const [items, profiles, settings, existing] = await Promise.all([
    fetchAll((a, b) => db.from("v_deadline_items").select("*").order("id").range(a, b)),
    fetchAll((a, b) => db.from("profiles").select("id, email, role, is_active, staff_id").is("archived_at", null).range(a, b)),
    db.from("settings").select("value").eq("key", "reminder_milestones").maybeSingle(),
    fetchAll((a, b) => db.from("reminder_events").select("requirement_instance_id, credential_id, milestone, recipient_id, due_date, notice_date").eq("channel", "email").order("id").range(a, b)),
  ]);
  const active = new Map(profiles.filter((p) => p.is_active).map((p) => [p.id, p]));
  const directorIds = profiles.filter((p) => p.is_active && p.role === "director").map((p) => p.id);
  const byStaff = new Map(profiles.filter((p) => p.is_active && p.staff_id).map((p) => [p.staff_id!, p.id]));
  const enabled = Array.isArray(settings.data?.value) ? ALL.filter((m) => (settings.data!.value as unknown[]).includes(m)) : ALL;

  const reminderItems: ReminderItem[] = items.map((i) => ({
    kind: i.kind === "credential" ? "credential" : "requirement",
    id: i.id!,
    dueDate: i.due_date!,
    // A credential with no renewal owner belongs to the staff member it is about.
    ownerId: i.owner_id ?? (i.kind === "credential" ? (byStaff.get(i.subject_id!) ?? null) : null),
    backupId: i.backup_id,
    critical: i.critical === true,
  }));
  const alreadySent = new Set(
    existing.filter((e) => e.due_date).map((e) =>
      reminderKey({ kind: e.credential_id ? "credential" : "requirement", itemId: (e.credential_id ?? e.requirement_instance_id)!, milestone: e.milestone, recipientId: e.recipient_id, dueDate: e.due_date!, noticeDate: e.notice_date }),
    ),
  );
  const planned = planReminders(reminderItems, today, { enabled, directorIds, alreadySent }).filter((p) => active.has(p.recipientId));
  const title = new Map(items.map((i) => [i.id!, i.subject_label ? `${i.title} (${i.subject_label})` : i.title!]));

  // 60 days out: a preparation task for the owner (requirement items only; one open renewal task per item).
  for (const p of planned.filter((x) => x.createTask && x.kind === "requirement")) {
    const { count } = await db.from("tasks").select("id", { count: "exact", head: true }).eq("requirement_instance_id", p.itemId).eq("kind", "renewal").in("status", ["open", "in_progress"]);
    if ((count ?? 0) === 0) {
      await db.from("tasks").insert({ requirement_instance_id: p.itemId, title: `Prepare renewal: ${title.get(p.itemId) ?? "item"}`, assignee_id: p.recipientId, due_date: p.dueDate, kind: "renewal" });
    }
  }
  if (planned.length > 0) {
    await db.from("reminder_events").upsert(
      planned.map((p) => ({
        requirement_instance_id: p.kind === "requirement" ? p.itemId : null,
        credential_id: p.kind === "credential" ? p.itemId : null,
        milestone: p.milestone,
        recipient_id: p.recipientId,
        due_date: p.dueDate,
        notice_date: p.noticeDate,
      })),
      { onConflict: "requirement_instance_id,credential_id,milestone,recipient_id,due_date,notice_date", ignoreDuplicates: true },
    );
  }

  // Critical eligibility concern: an ineligible record goes to every director, once per day.
  const { data: ineligible } = await db.from("credentials").select("id").eq("eligibility_status", "ineligible").is("archived_at", null);
  if ((ineligible ?? []).length > 0 && directorIds.length > 0) {
    await db.from("reminder_events").upsert(
      (ineligible ?? []).flatMap((c) => directorIds.map((d) => ({ credential_id: c.id, milestone: "critical" as const, recipient_id: d, due_date: today }))),
      { onConflict: "requirement_instance_id,credential_id,milestone,recipient_id,due_date,notice_date", ignoreDuplicates: true },
    );
  }

  // Send what is queued, and retry earlier failures.
  const outbox = await fetchAll((a, b) =>
    db.from("reminder_events").select("*").eq("channel", "email").in("status", ["queued", "failed"]).lt("attempts", MAX_ATTEMPTS).order("id").range(a, b),
  );
  let sent = 0;
  let failed = 0;
  for (const e of outbox) {
    const recipient = active.get(e.recipient_id);
    if (!recipient) {
      await db.from("reminder_events").update({ status: "suppressed", last_error: "Recipient is not active." }).eq("id", e.id);
      continue;
    }
    const itemId = e.credential_id ?? e.requirement_instance_id;
    const label = (itemId && title.get(itemId)) || "An item";
    const link = e.requirement_instance_id ? `${appUrl()}/items/${e.requirement_instance_id}` : `${appUrl()}/calendar`;
    const email =
      e.milestone === "critical"
        ? criticalAlertEmail({ url: `${appUrl()}/staff` })
        : e.milestone === "rejected"
          ? evidenceRejectedEmail({ title: label, url: link })
          : reminderEmail({ milestoneLabel: MILESTONE_LABEL[e.milestone], title: label, dueDate: e.due_date ?? "", url: link });
    const result = await sendEmail(recipient.email, email);
    if (result.ok) {
      sent += 1;
      await db.from("reminder_events").update({ status: "sent", attempts: e.attempts + 1, provider_message_id: result.id, sent_at: new Date().toISOString(), last_error: null }).eq("id", e.id);
    } else {
      failed += 1;
      await db.from("reminder_events").update({ status: "failed", attempts: e.attempts + 1, last_error: result.error }).eq("id", e.id);
    }
  }

  await setMarker(db, "cron_daily_last_run", today);
  return NextResponse.json({ date: today, planned: planned.length, sent, failed });
}
