// Generate src/lib/database.types.ts from a Postgres database that has the migrations
// applied (BUILD.md: "Regenerate src/lib/database.types.ts after each migration").
//
//   DATABASE_URL=$(scripts/db-local.sh start) pnpm db:types
//
// The output follows the shape of `supabase gen types typescript`, so the Supabase CLI
// can replace this script once a project is linked.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (see scripts/db-local.sh).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const enums = (
  await client.query(`
    select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder)::text[] as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname
    order by t.typname`)
).rows;
const enumNames = new Set(enums.map((e) => e.name));

const columns = (
  await client.query(`
    select c.relname as rel, c.relkind as kind, a.attname as col, t.typname as typ,
           a.attnotnull as notnull, (a.atthasdef or a.attidentity <> '') as hasdef
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public' and c.relkind in ('r', 'v') and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum`)
).rows;

function tsType(typ) {
  if (enumNames.has(typ)) return `Database["public"]["Enums"]["${typ}"]`;
  switch (typ) {
    case "int2":
    case "int4":
    case "int8":
    case "float4":
    case "float8":
    case "numeric":
      return "number";
    case "bool":
      return "boolean";
    case "json":
    case "jsonb":
      return "Json";
    default:
      return "string";
  }
}

const rels = new Map();
for (const c of columns) {
  if (!rels.has(c.rel)) rels.set(c.rel, { kind: c.kind, cols: [] });
  rels.get(c.rel).cols.push(c);
}

const out = [];
out.push("// GENERATED FILE. Do not edit by hand. Regenerate with `pnpm db:types`.");
out.push("");
out.push("export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];");
out.push("");
out.push("export type Database = {");
out.push("  public: {");
out.push("    Tables: {");
for (const [name, rel] of rels) {
  if (rel.kind !== "r") continue;
  out.push(`      ${name}: {`);
  out.push("        Row: {");
  for (const c of rel.cols) out.push(`          ${c.col}: ${tsType(c.typ)}${c.notnull ? "" : " | null"};`);
  out.push("        };");
  out.push("        Insert: {");
  for (const c of rel.cols) {
    const optional = !c.notnull || c.hasdef;
    out.push(`          ${c.col}${optional ? "?" : ""}: ${tsType(c.typ)}${c.notnull ? "" : " | null"};`);
  }
  out.push("        };");
  out.push("        Update: {");
  for (const c of rel.cols) out.push(`          ${c.col}?: ${tsType(c.typ)}${c.notnull ? "" : " | null"};`);
  out.push("        };");
  out.push("        Relationships: [];");
  out.push("      };");
}
out.push("    };");
out.push("    Views: {");
for (const [name, rel] of rels) {
  if (rel.kind !== "v") continue;
  out.push(`      ${name}: {`);
  out.push("        Row: {");
  for (const c of rel.cols) out.push(`          ${c.col}: ${tsType(c.typ)} | null;`);
  out.push("        };");
  out.push("        Relationships: [];");
  out.push("      };");
}
out.push("    };");
out.push("    Functions: {");
out.push('      auth_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["app_role"] | null };');
out.push("      auth_staff_id: { Args: Record<PropertyKey, never>; Returns: string | null };");
out.push('      can_access_class: { Args: { cls: Database["public"]["Enums"]["access_class"] }; Returns: boolean };');
out.push("      chicago_today: { Args: Record<PropertyKey, never>; Returns: string };");
out.push("    };");
out.push("    Enums: {");
for (const e of enums) out.push(`      ${e.name}: ${e.labels.map((l) => JSON.stringify(l)).join(" | ")};`);
out.push("    };");
out.push("    CompositeTypes: Record<PropertyKey, never>;");
out.push("  };");
out.push("};");
out.push("");
out.push('export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];');
out.push('export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];');
out.push('export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];');
out.push("");
out.push("export const Constants = {");
out.push("  public: {");
out.push("    Enums: {");
for (const e of enums) out.push(`      ${e.name}: [${e.labels.map((l) => JSON.stringify(l)).join(", ")}],`);
out.push("    },");
out.push("  },");
out.push("} as const;");
out.push("");

const target = fileURLToPath(new URL("../src/lib/database.types.ts", import.meta.url));
writeFileSync(target, out.join("\n"));
await client.end();
console.log(`Wrote ${target} (${rels.size} relations, ${enums.length} enums)`);
