import type { Metadata } from "next";
import { Empty, PageHeader, Section, Table, Td } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/auth/session";
import { fetchAll } from "@/lib/data";
import { chicagoToday, daysBetween, formatDateOnly } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calendar" };

const BANDS = [
  { title: "Overdue", test: (d: number) => d < 0 },
  { title: "Next 30 days", test: (d: number) => d >= 0 && d <= 30 },
  { title: "31 to 60 days", test: (d: number) => d > 30 && d <= 60 },
  { title: "61 to 90 days", test: (d: number) => d > 60 && d <= 90 },
];

export default async function CalendarPage() {
  await requirePermission("overview.read");
  const db = await createClient();
  const items = await fetchAll((a, b) => db.from("v_deadline_items").select("*").order("due_date").range(a, b));
  const today = chicagoToday();
  return (
    <>
      <PageHeader title="30 / 60 / 90 renewal calendar" description={`Requirement items and credentials by due date, as of ${formatDateOnly(today)} (Central time).`} />
      {BANDS.map((band) => {
        const rows = items.filter((i) => band.test(daysBetween(today, i.due_date!)));
        return (
          <Section key={band.title} title={`${band.title} (${rows.length})`}>
            {rows.length === 0 ? <Empty>Nothing.</Empty> : (
              <Table>
                <tbody>
                  {rows.map((i) => (
                    <tr key={`${i.kind}-${i.id}`}>
                      <Td className="w-32 whitespace-nowrap">{formatDateOnly(i.due_date!)}</Td>
                      <Td>{i.title}<span className="block text-xs text-muted-foreground">{i.subject_label} · {i.kind === "credential" ? "Credential" : "Requirement"}</span></Td>
                      <Td>{i.verified ? <Badge>Verified, renewal coming</Badge> : <Badge tone="amber">Not verified</Badge>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Section>
        );
      })}
    </>
  );
}
