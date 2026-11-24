"use client";

import { useActionState } from "react";
import { runImport, type ImportState } from "@/actions/imports";
import { Field, Select, Textarea } from "@/components/forms/fields";
import { Table, Td, Th } from "@/components/tables/Table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IMPORT_COLUMNS } from "@/lib/csv/imports";

const initial: ImportState = { preview: null, message: null, ok: false, csv: "", kind: "staff" };

export function ImportForm() {
  const [state, action, pending] = useActionState(runImport, initial);
  const ready = state.preview?.rows.filter((r) => r.status === "ready").length ?? 0;
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What are you importing?" name="kind">
          <Select id="kind" name="kind" defaultValue={state.kind} key={state.kind}>
            <option value="staff">Staff</option>
            <option value="credentials">Credentials</option>
            <option value="training">Training records</option>
          </Select>
        </Field>
        <Field label="CSV file" name="file"><Input id="file" name="file" type="file" accept=".csv,text/csv" /></Field>
      </div>
      <Field label="Or paste the CSV text" name="csv" hint="After a preview the text stays here, so Import uses exactly what you previewed.">
        <Textarea id="csv" name="csv" defaultValue={state.csv} key={state.csv} className="min-h-32 font-mono text-xs" />
      </Field>
      <div className="text-xs text-muted-foreground">
        {(Object.keys(IMPORT_COLUMNS) as (keyof typeof IMPORT_COLUMNS)[]).map((k) => <p key={k}><strong>{k}</strong> columns: {IMPORT_COLUMNS[k].join(", ")}</p>)}
        <p>Dates are YYYY-MM-DD. Training length is whole minutes.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" name="intent" value="preview" variant="outline" disabled={pending}>{pending ? "Working…" : "Preview"}</Button>
        {state.preview && ready > 0 ? <Button type="submit" name="intent" value="import" disabled={pending}>Import {ready} ready row{ready === 1 ? "" : "s"}</Button> : null}
        {state.message ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-status-green" : "text-sm text-status-red"}>{state.message}</p> : null}
      </div>
      {state.preview && state.preview.rows.length > 0 ? (
        <Table>
          <thead><tr><Th>Line</Th><Th>Result</Th>{IMPORT_COLUMNS[state.preview.kind].map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
          <tbody>
            {state.preview.rows.map((r) => (
              <tr key={r.line}>
                <Td>{r.line}</Td>
                <Td><Badge tone={r.status === "ready" ? "green" : r.status === "duplicate" ? "amber" : "red"}>{r.status === "ready" ? "Ready" : r.status === "duplicate" ? "Duplicate, skipped" : "Error, skipped"}</Badge>{r.problem ? <span className="mt-1 block text-xs">{r.problem}</span> : null}</Td>
                {IMPORT_COLUMNS[state.preview!.kind].map((c) => <Td key={c}>{r.values[c] ?? ""}</Td>)}
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </form>
  );
}
