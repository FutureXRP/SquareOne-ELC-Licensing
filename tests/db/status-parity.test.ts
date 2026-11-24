import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chicagoToday } from "@/lib/dates";
import {
  deriveDeadlineStatus,
  deriveEvidenceStatus,
  isGreen,
  type EvidenceStatus,
  type LinkFact,
} from "@/lib/domain/status";

/**
 * Parity: the SQL view v_requirement_status and src/lib/domain/status.ts must give the
 * same answer for the same records (BUILD.md section 5).
 *
 * Needs a database with migrations and seed applied:
 *   export DATABASE_URL=$(scripts/db-local.sh start)
 * Everything here runs in one transaction that is rolled back. Synthetic data only.
 */
const url = process.env.DATABASE_URL;
const DIRECTOR = "a0000000-0000-4000-8000-0000000000d1";
const STAFF = "30000000-0000-4000-8000-000000000003";

// Each fixture: an instance on an active version with a set of links (offsets in days from today).
type Fixture = {
  name: string;
  expected: EvidenceStatus;
  na?: boolean;
  draft?: boolean;
  links?: { status: "pending" | "approved" | "rejected"; createdAgo: number; reviewedAgo?: number; expiresIn?: number }[];
};

const fixtures: Fixture[] = [
  { name: "no evidence", expected: "missing" },
  { name: "approved N/A exception", expected: "not_applicable", na: true },
  { name: "draft version with approved evidence", expected: "unknown", draft: true, links: [{ status: "approved", createdAgo: 9, reviewedAgo: 8 }] },
  { name: "pending upload", expected: "pending_review", links: [{ status: "pending", createdAgo: 2 }] },
  { name: "approved, no expiry", expected: "verified", links: [{ status: "approved", createdAgo: 9, reviewedAgo: 8 }] },
  { name: "approved, expires today", expected: "verified", links: [{ status: "approved", createdAgo: 9, reviewedAgo: 8, expiresIn: 0 }] },
  { name: "approved, expired yesterday", expected: "missing", links: [{ status: "approved", createdAgo: 9, reviewedAgo: 8, expiresIn: -1 }] },
  { name: "rejected", expected: "needs_correction", links: [{ status: "rejected", createdAgo: 9, reviewedAgo: 8 }] },
  { name: "rejected, older pending", expected: "needs_correction", links: [{ status: "rejected", createdAgo: 9, reviewedAgo: 5 }, { status: "pending", createdAgo: 7 }] },
  { name: "rejected, then resubmitted", expected: "pending_review", links: [{ status: "rejected", createdAgo: 9, reviewedAgo: 8 }, { status: "pending", createdAgo: 3 }] },
  { name: "approved, later rejection of other evidence", expected: "verified", links: [{ status: "approved", createdAgo: 9, reviewedAgo: 8 }, { status: "rejected", createdAgo: 6, reviewedAgo: 5 }] },
  { name: "expired approval, later rejection", expected: "needs_correction", links: [{ status: "approved", createdAgo: 90, reviewedAgo: 80, expiresIn: -10 }, { status: "rejected", createdAgo: 6, reviewedAgo: 5 }] },
  { name: "rejected, then approved", expected: "verified", links: [{ status: "rejected", createdAgo: 9, reviewedAgo: 8 }, { status: "approved", createdAgo: 6, reviewedAgo: 5 }] },
];
const dueOffsets = [null, -400, -1, 0, 1, 7, 8, 30, 31, 365];

describe.skipIf(!url)("v_requirement_status parity with lib/domain/status", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query("begin");
    await client.query(`insert into auth.users (id, email, raw_app_meta_data) values ($1, 'parity-director@example.test', '{"role":"director"}')`, [DIRECTOR]);
    // Two active versions (one per fixture family) built from seeded drafts.
    await client.query(
      `update public.requirement_versions
          set status = 'active', citation = 'Synthetic citation', source_url = 'https://example.test/rule',
              last_source_review = public.chicago_today(), reviewed_by = $1, frequency = 'recurring', criticality = 'regulatory'
        where id in ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002')`,
      [DIRECTOR],
    );

    let n = 0;
    for (const f of fixtures) {
      n += 1;
      const version = f.draft ? "60000000-0000-4000-8000-000000000003" : "60000000-0000-4000-8000-000000000001";
      const { rows } = await client.query(
        `insert into public.requirement_instances (requirement_version_id, subject_type, subject_id, na_reason, na_approved_by, na_approved_at)
         values ($1, 'staff', $2, $3, $4, $5) returning id`,
        [version, STAFF, f.na ? `fixture: ${f.name}` : null, f.na ? DIRECTOR : null, f.na ? new Date() : null],
      );
      const instanceId = rows[0].id as string;
      let k = 0;
      for (const l of f.links ?? []) {
        k += 1;
        const ev = await client.query(
          `insert into public.evidence (doc_type, storage_path, file_name, subject_type, subject_id, uploader_id, access_class, expiry_date)
           values ('fixture', $1, 'f.pdf', 'staff', $2, $3, 'personnel',
                   case when $4::int is null then null else public.chicago_today() + $4::int end) returning id`,
          [`personnel/staff/${STAFF}/fixture-${n}-${k}/f.pdf`, STAFF, DIRECTOR, l.expiresIn ?? null],
        );
        const link = await client.query(
          `insert into public.evidence_links (evidence_id, requirement_instance_id, created_at)
           values ($1, $2, now() - make_interval(days => $3::int)) returning id`,
          [ev.rows[0].id, instanceId, l.createdAgo],
        );
        if (l.status !== "pending") {
          await client.query(
            `update public.evidence_links
                set status = $2::public.link_status, reviewer_id = $3, reviewed_at = now() - make_interval(days => $4::int),
                    correction_note = case when $2::text = 'rejected' then 'Synthetic correction note' end
              where id = $1`,
            [link.rows[0].id, l.status, DIRECTOR, l.reviewedAgo],
          );
        }
      }
    }
    // Deadline boundaries on the second active version.
    for (const offset of dueOffsets) {
      await client.query(
        `insert into public.requirement_instances (requirement_version_id, subject_type, subject_id, due_date)
         values ('60000000-0000-4000-8000-000000000002', 'staff', $1,
                 case when $2::int is null then null else public.chicago_today() + $2::int end)`,
        [STAFF, offset],
      );
    }
  });

  afterAll(async () => {
    await client.query("rollback");
    await client.end();
  });

  it("agrees on the Chicago calendar date", async () => {
    const { rows } = await client.query("select public.chicago_today()::text as today");
    expect(rows[0].today).toBe(chicagoToday());
  });

  it("the fixtures produce the statuses the rules call for", async () => {
    const { rows } = await client.query(
      `select ri.na_reason, s.evidence_status, count(*)::int as n
         from public.v_requirement_status s
         join public.requirement_instances ri on ri.id = s.requirement_instance_id
        where ri.created_at >= transaction_timestamp()
        group by 1, 2`,
    );
    const seen = new Set(rows.map((r) => r.evidence_status as string));
    for (const f of fixtures) expect(seen, f.name).toContain(f.expected);
  });

  it("matches the view for every instance, evidence and deadline", async () => {
    const today = (await client.query("select public.chicago_today()::text as today")).rows[0].today as string;
    const settings = await client.query(
      "select public.setting_int('urgent_days', 7) as urgent, public.setting_int('due_soon_days', 30) as due_soon",
    );
    const thresholds = { urgentDays: settings.rows[0].urgent as number, dueSoonDays: settings.rows[0].due_soon as number };

    const view = await client.query(
      `select requirement_instance_id as id, evidence_status, deadline_status, is_green from public.v_requirement_status`,
    );
    const instances = await client.query(
      `select ri.id, ri.na_approved_by, ri.na_reason, ri.due_date::text as due_date,
              rv.status as version_status, rv.last_source_review::text as last_source_review
         from public.requirement_instances ri
         join public.requirement_versions rv on rv.id = ri.requirement_version_id
        where ri.archived_at is null`,
    );
    const links = await client.query(
      `select l.id, l.requirement_instance_id, l.status, l.created_at, l.reviewed_at, e.expiry_date::text as expiry_date
         from public.evidence_links l
         join public.evidence e on e.id = l.evidence_id
        where l.archived_at is null and e.archived_at is null`,
    );

    const linksByInstance = new Map<string, LinkFact[]>();
    for (const l of links.rows) {
      const list = linksByInstance.get(l.requirement_instance_id) ?? [];
      list.push({
        id: l.id,
        status: l.status,
        createdAt: (l.created_at as Date).toISOString(),
        reviewedAt: l.reviewed_at ? (l.reviewed_at as Date).toISOString() : null,
        evidenceExpiryDate: l.expiry_date,
      });
      linksByInstance.set(l.requirement_instance_id, list);
    }
    const viewById = new Map(view.rows.map((r) => [r.id as string, r]));

    expect(instances.rows.length).toBe(view.rows.length);
    expect(instances.rows.length).toBeGreaterThan(fixtures.length + dueOffsets.length);

    for (const i of instances.rows) {
      const evidence = deriveEvidenceStatus(
        {
          naApprovedBy: i.na_approved_by,
          naReason: i.na_reason,
          versionStatus: i.version_status,
          lastSourceReview: i.last_source_review,
          links: linksByInstance.get(i.id) ?? [],
        },
        today,
      );
      const deadline = deriveDeadlineStatus(i.due_date, today, thresholds);
      const v = viewById.get(i.id);
      expect({ id: i.id, evidence, deadline, green: isGreen(evidence, deadline) }).toEqual({
        id: i.id,
        evidence: v?.evidence_status,
        deadline: v?.deadline_status,
        green: v?.is_green,
      });
    }

    // The credential and calendar views use the same deadline formula.
    const creds = await client.query(`select id, expiration_date::text as expiration_date, deadline_status, verified_at, is_verified_current from public.v_credentials`);
    expect(creds.rows.length).toBeGreaterThan(0);
    for (const c of creds.rows) {
      expect({ id: c.id, deadline: deriveDeadlineStatus(c.expiration_date, today, thresholds) }).toEqual({ id: c.id, deadline: c.deadline_status });
      // An expired credential is never verified/current, whatever its review says.
      if (c.expiration_date !== null && c.expiration_date < today) expect(c.is_verified_current).toBe(false);
    }
    const dated = await client.query(`select kind, id, due_date::text as due_date, deadline_status from public.v_deadline_items`);
    for (const d of dated.rows) {
      expect({ id: d.id, deadline: deriveDeadlineStatus(d.due_date, today, thresholds) }).toEqual({ id: d.id, deadline: d.deadline_status });
    }

    // Every deadline status and every evidence status is exercised.
    expect(new Set(view.rows.map((r) => r.deadline_status))).toEqual(
      new Set(["none", "overdue", "urgent", "due_soon", "current"]),
    );
    expect(new Set(view.rows.map((r) => r.evidence_status))).toEqual(
      new Set(["missing", "pending_review", "needs_correction", "verified", "not_applicable", "unknown"]),
    );
  });
});
