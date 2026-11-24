import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Db } from "@/lib/data";
import type { Json } from "@/lib/database.types";

/** Every /api/cron request must carry `Authorization: Bearer ${CRON_SECRET}`. */
export function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const remindersEnabled = () => process.env.REMINDERS_ENABLED === "true";

export async function getMarker(db: Db, key: string): Promise<string | null> {
  const { data } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  return typeof data?.value === "string" ? data.value : null;
}

export async function setMarker(db: Db, key: string, value: string): Promise<void> {
  await db.from("settings").upsert({ key, value: value as Json }, { onConflict: "key" });
}

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
