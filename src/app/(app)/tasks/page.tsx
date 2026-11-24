import type { Metadata } from "next";
import Link from "next/link";
import { assignTask, createTask, setTaskStatus } from "@/actions/tasks";
import { ActionForm } from "@/components/forms/ActionForm";
import { FormGrid, Select, SelectField, TextField } from "@/components/forms/fields";
import { Empty, PageHeader, Section, Table, Td, Th } from "@/components/tables/Table";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll, listProfiles, personLabel, profileNames } from "@/lib/data";
import { formatDateOnly } from "@/lib/dates";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tasks" };

const KIND: Record<string, string> = { renewal: "Renewal", correction: "Correction", follow_up: "Follow-up", corrective_action: "Corrective action", manual: "Task" };

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const session = await requirePermission("overview.read");
  const showDone = (await searchParams).show === "all";
  const db = await createClient();
  const manage = can(session.role, "tasks.manage");
  const [tasks, profiles] = await Promise.all([
    fetchAll((a, b) => {
      let q = db.from("tasks").select("*").is("archived_at", null).order("due_date", { nullsFirst: false }).order("created_at");
      if (!showDone) q = q.in("status", ["open", "in_progress"]);
      return q.range(a, b);
    }),
    manage ? listProfiles(db) : Promise.resolve([]),
  ]);
  const names = await profileNames(db, tasks.map((t) => t.assignee_id));
  const people = profiles.filter((p) => p.is_active && p.role !== "auditor").map((p) => ({ value: p.id, label: personLabel(p) }));

  return (
    <>
      <PageHeader title="Tasks" description={manage ? "Every open task." : "Tasks assigned to you."}>
        <Link className="text-sm text-primary hover:underline" href={showDone ? "/tasks" : "/tasks?show=all"}>{showDone ? "Hide finished" : "Show finished too"}</Link>
      </PageHeader>
      {manage ? (
        <Section title="Add a task">
          <ActionForm action={createTask} submitLabel="Add task">
            <FormGrid>
              <TextField label="What needs doing" name="title" required maxLength={200} />
              <SelectField label="Assign to" name="assignee_id" options={people} blank="Unassigned" />
              <TextField label="Due date" name="due_date" type="date" />
            </FormGrid>
          </ActionForm>
        </Section>
      ) : null}
      <Section title={showDone ? "All tasks" : "Open tasks"}>
        {tasks.length === 0 ? <Empty>No tasks.</Empty> : (
          <Table>
            <thead><tr><Th>Task</Th><Th>Assigned to</Th><Th>Due</Th><Th>Status</Th></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <Td>
                    {t.requirement_instance_id ? <Link className="font-medium hover:underline" href={`/items/${t.requirement_instance_id}`}>{t.title}</Link> : <span className="font-medium">{t.title}</span>}
                    <span className="block text-xs text-muted-foreground">{KIND[t.kind] ?? t.kind}</span>
                  </Td>
                  <Td>
                    {manage ? (
                      <ActionForm action={assignTask} submitLabel="Save" size="sm" variant="outline" inline>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="due_date" value={t.due_date ?? ""} />
                        <Select name="assignee_id" defaultValue={t.assignee_id ?? ""} aria-label="Assignee" className="h-8 w-40 py-0">
                          <option value="">Unassigned</option>
                          {people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </Select>
                      </ActionForm>
                    ) : ((t.assignee_id && names.get(t.assignee_id)) || "Unassigned")}
                  </Td>
                  <Td className="whitespace-nowrap">{t.due_date ? formatDateOnly(t.due_date) : "—"}</Td>
                  <Td>
                    <ActionForm action={setTaskStatus} submitLabel="Set" size="sm" variant="outline" inline>
                      <input type="hidden" name="id" value={t.id} />
                      <Select name="status" defaultValue={t.status} aria-label="Status" className="h-8 w-32 py-0">
                        {Object.entries(TASK_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    </ActionForm>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
