import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The only way to a stored file. Re-checks permission on every request: the evidence row
 * must be visible to the caller under Row Level Security, and the link is signed with the
 * caller's own session (storage policies mirror the table), valid for 60 seconds.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (session.role === null || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await createClient();
  const { data: evidence } = await db.from("evidence").select("storage_path, file_name").eq("id", id).is("archived_at", null).maybeSingle();
  if (!evidence) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await db.storage.from("evidence").createSignedUrl(evidence.storage_path, 60);
  if (error || !data) return NextResponse.json({ error: "The file is not available." }, { status: 404 });
  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
