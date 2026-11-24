/**
 * Email templates. Rule 8: a notice carries a requirement title, a due date and a link.
 * No documents, no child names, no health details, no correction notes.
 * Plain HTML strings (escaped), so they render the same everywhere and need no build step.
 */

export type Email = { subject: string; html: string; text: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(heading: string, lines: string[], link: { href: string; label: string }): Email["html"] {
  return `<!doctype html><html><body style="margin:0;background:#f7f3ea;font-family:Arial,Helvetica,sans-serif;color:#1c2733">
<div style="max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:13px;color:#5b6670;margin:0 0 8px">SquareOne ELC Compliance Center</p>
<h1 style="font-size:18px;margin:0 0 12px;color:#26384a">${esc(heading)}</h1>
${lines.map((l) => `<p style="font-size:15px;line-height:22px;margin:0 0 8px">${l}</p>`).join("\n")}
<p style="margin:16px 0"><a href="${esc(link.href)}" style="background:#26384a;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:15px">${esc(link.label)}</a></p>
<p style="font-size:12px;color:#5b6670;margin:16px 0 0">Internal readiness indicator. Not an official compliance determination.</p>
</div></body></html>`;
}

export function reminderEmail(p: { milestoneLabel: string; title: string; dueDate: string; url: string }): Email {
  return {
    subject: `${p.milestoneLabel}: ${p.title}`,
    html: layout(p.milestoneLabel, [`<strong>${esc(p.title)}</strong>`, `Due date: ${esc(p.dueDate)}`], { href: p.url, label: "Open in the Compliance Center" }),
    text: `${p.milestoneLabel}\n${p.title}\nDue date: ${p.dueDate}\n${p.url}`,
  };
}

export function evidenceRejectedEmail(p: { title: string; url: string }): Email {
  return {
    subject: `Returned for correction: ${p.title}`,
    html: layout("A submission was returned for correction", [`<strong>${esc(p.title)}</strong>`, "Sign in to read the correction note and resubmit."], { href: p.url, label: "Open the item" }),
    text: `A submission was returned for correction\n${p.title}\nSign in to read the correction note and resubmit.\n${p.url}`,
  };
}

export function criticalAlertEmail(p: { url: string }): Email {
  return {
    subject: "Critical eligibility concern needs your attention",
    html: layout("Critical eligibility concern", ["A staff eligibility record needs immediate review.", "Details are in the Compliance Center, not in this email."], { href: p.url, label: "Review now" }),
    text: `Critical eligibility concern\nA staff eligibility record needs immediate review. Details are in the Compliance Center.\n${p.url}`,
  };
}

export function weeklyDigestEmail(p: { items: { title: string; dueDate: string; overdue: boolean }[]; url: string }): Email {
  const rows = p.items.map((i) => `${i.overdue ? "Overdue" : "Due"} ${esc(i.dueDate)}: ${esc(i.title)}`);
  return {
    subject: `Weekly summary: ${p.items.length} item${p.items.length === 1 ? "" : "s"} coming due or overdue`,
    html: layout("Your weekly summary", rows, { href: p.url, label: "Open your items" }),
    text: `Your weekly summary\n${p.items.map((i) => `${i.overdue ? "Overdue" : "Due"} ${i.dueDate}: ${i.title}`).join("\n")}\n${p.url}`,
  };
}

export function invitationEmail(p: { url: string }): Email {
  return {
    subject: "Your SquareOne ELC Compliance Center account",
    html: layout("You have been invited", ["Your director set up an account for you.", "Open the link to choose a password. It works once."], { href: p.url, label: "Set up my account" }),
    text: `You have been invited to the SquareOne ELC Compliance Center.\nOpen this link to choose a password. It works once.\n${p.url}`,
  };
}
