import type { Metadata } from "next";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/session";
import { fetchAll, getSettings, profileNames } from "@/lib/data";
import type { Tables } from "@/lib/database.types";
import { MILESTONE_LABEL } from "@/lib/domain/reminders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

const TONE = { sent: "green", failed: "red", queued: "amber", suppressed: "neutral" } as const;

export default async function NotificationsPage() {
  await requireRole("director", "admin_support");
  const db = await createClient();
  const [events, settings] = await Promise.all([
    fetchAll((a, b) => db.from("reminder_events").select("*").order("created_at", { ascending: false }).range(a, Math.min(b, a + 199))),
    getSettings(db),
  ]);
  const names = await profileNames(db, events.map((e) => e.recipient_id));
  const failed = events.filter((e) => e.status === "failed");
  const enabled = process.env.REMINDERS_ENABLED === "true";

  return (
    <>
      <PageHeader title="Notifications" description="Every send attempt is logged here. Emails carry a requirement title, a due date and a link, never a document or personal details." />
      <Section title="Status">
        <p className="text-sm">
          Reminder emails are <strong>{enabled ? "on" : "off"}</strong> for this deployment (REMINDERS_ENABLED). {enabled ? "" : "Nothing is sent until a director approves the thresholds and the setting is turned on."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Milestones: {Array.isArray(settings.reminder_milestones) ? (settings.reminder_milestones as string[]).join(", ") : "default"} · Weekly digest day: {String(settings.digest_day ?? "monday")} · Last daily run: {String(settings.cron_daily_last_run ?? "never")}</p>
      </Section>
      <Section title={`Failed deliveries (${failed.length})`} description="Failed sends are retried by the next daily run, up to five attempts.">
        {failed.length === 0 ? <Empty>No failed deliveries.</Empty> : <Log rows={failed} names={names} />}
      </Section>
      <Section title="Delivery log" description="Most recent 200.">
        {events.length === 0 ? <Empty>No notices yet.</Empty> : <Log rows={events} names={names} />}
      </Section>
    </>
  );

}

function Log({ rows, names }: { rows: Tables<"reminder_events">[]; names: Map<string, string> }) {
    return (
      <Table>
        <thead><tr><Th>Created</Th><Th>Notice</Th><Th>To</Th><Th>Status</Th><Th>Attempts</Th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap">{new Date(e.created_at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}</Td>
              <Td>{MILESTONE_LABEL[e.milestone]}{e.due_date ? <span className="block text-xs text-muted-foreground">due {e.due_date}</span> : null}</Td>
              <Td>{names.get(e.recipient_id) ?? "—"}</Td>
              <Td><Badge tone={TONE[e.status]}>{e.status}</Badge>{e.last_error ? <span className="mt-1 block text-xs text-status-red">{e.last_error}</span> : null}</Td>
              <Td className="tabular-nums">{e.attempts}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  }
