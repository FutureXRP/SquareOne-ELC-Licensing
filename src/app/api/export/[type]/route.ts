import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv/parse";
import { chicagoToday } from "@/lib/dates";
import { READINESS_DISCLAIMER } from "@/lib/domain/readiness";
import { buildReport, isReportType } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

/** CSV export of a report. Built with the caller's own session, so it holds only what RLS lets them read. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/export/[type]">) {
  const { type } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(session.role, "overview.read") || !isReportType(type)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const report = await buildReport(await createClient(), type, { authority: request.nextUrl.searchParams.get("authority") ?? undefined });
  const today = chicagoToday();
  const header = toCsv(["Report", report.title], [["Generated (Central time)", today], ["Filters", report.filters], ["Note", report.note], ["", READINESS_DISCLAIMER], []]);
  return new NextResponse(header + toCsv(report.columns, report.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
