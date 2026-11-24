import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation/auth";

const OTP_TYPES: readonly EmailOtpType[] = ["invite", "magiclink", "recovery", "email", "signup", "email_change"];

/**
 * Completes an invitation, magic-link or recovery email. Supabase sends either a PKCE
 * `code` or a `token_hash` + `type`. The post-login destination is restricted to
 * same-site paths.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Redirect on the host the browser used, so the session cookie set here is sent back.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const origin = `${proto}://${host}`;
  const next = safeNextPath(searchParams.get("next"));
  const failed = NextResponse.redirect(new URL("/login", origin));
  if (!isSupabaseConfigured()) return failed;

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return failed;
}
