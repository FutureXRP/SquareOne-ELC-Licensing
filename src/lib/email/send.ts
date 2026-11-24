import "server-only";
import { Resend } from "resend";
import type { Email } from "../../../emails/templates";

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

/** Resend wrapper. Never throws: the caller logs every attempt, success or failure. */
export async function sendEmail(to: string, email: Email): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "Email is not configured (RESEND_API_KEY and EMAIL_FROM)." };
  try {
    const replyTo = process.env.EMAIL_REPLY_TO || undefined;
    const { data, error } = await new Resend(key).emails.send({
      // Display name approved by the director; the address must be on a verified SquareOne domain.
      from: from.includes("<") ? from : `SquareOne ELC Compliance <${from}>`,
      to,
      replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (error) return { ok: false, error: `${error.name}: ${error.message}`.slice(0, 300) };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : "Unknown send error").slice(0, 300) };
  }
}
