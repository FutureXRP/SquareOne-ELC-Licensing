# Decisions

## Director's answers (2026-11-24)

Source: "SquareOne ELC Compliance Center Decision Answers", prepared for the director, dated
November 24, 2026. Go-live position: **approved with conditions**. The copy received had the
signature line blank; these are recorded as the working rules for continued development.
Real SquareOne data may not be entered until the five information-needed items below are done,
hosted security and role tests pass, and the director signs the production go-live record.

### Open decisions 1 to 10

| # | Decision | Director's answer | Status | In the build |
|---|---|---|---|---|
| 1 | Current license and approved capacity | Working capacity is 95. Do not mark it confirmed until the currently issued Oklahoma Human Services license is uploaded and shows 95. The prior 140 capacity is not current. | Verify (go-live blocker) | A license copy was supplied showing Total Capacity 95 (issued 03/03/2021, Five Stars effective 1/1/2023). The seed stays synthetic. On the production project the director enters 95 in Settings, Program and uploads the license as evidence. Whether that copy is the currently issued license is for the director to confirm. |
| 2 | Licensing and STARS rule versions | Activate Licensing Requirements for Child Care Programs, Pub. 14-05, effective 11-1-2025. Track the QRIS child care center criteria effective 6-1-2022 together with the later 5-Star accreditation requirement. Record source URL, effective date, review date and director approval for every active version. | Approve | Nothing is activated by code. The director activates each library entry with its citation, link and review date. Links are listed below. |
| 3 | APPLE renewal and reporting dates | Accreditation awarded August 6, 2025. Use August 6, 2028 as the planning expiration and verify the exact date on the certificate. Annual August report task; confirm the invoice due date in the APPLE member hub. Begin reaccreditation work by August 6, 2027. | Approve | Entered by the director as due dates on the APPLE items once they are active. No date is seeded. The APPLE certificate has not been supplied yet: the document received is the March 2025 offer of candidacy (candidacy through 10/1/2025), which does not show the award or expiration date. |
| 4 | Training targets and reporting period | Internal target of 30 professional-development hours per educator per year. Also track each person's CECPD/PDL expiration and renewal hours separately (current CECPD guidance: 12 hours for PDL Level 1, 20 for Levels 2 to 11), by each employee's renewal year. | Approve | The 30-hour internal target is already 1800 minutes; the director ticks it confirmed in Settings, Setup. New: PDL level and renewal date on each staff record, PDL renewal hours by level entered by the director with source link and review date, and a Training section that counts verified hours over each person's own renewal year. The 12 and 20 hour figures are not seeded. |
| 5 | Reminder thresholds and recipients | Standard: 90, 60, 30, 14 and 7 days, due date, then weekly overdue. Critical credentials, licenses and accreditation: add 120 days and 1 day, then daily overdue until resolved. Assigned employee first; the director at 30 days; the authorized backup at 14 days. No confidential details in email. | Approve | Implemented. Critical means regulatory, accreditation and safety-critical requirements, plus credential types the director marks critical in Settings, Setup. `REMINDERS_ENABLED` stays false. |
| 6 | Authorized reviewers and backups | Primary approver is the director. Admin support may prepare drafts but cannot activate rules or approve evidence. Director-only approval at launch. Before any director absence, name one backup in writing with start and end dates. | Conditional | Director-only approval is unchanged. Drafting by designated admin support is implemented (question C). A dated backup-reviewer delegation is **not built**: it waits for information-needed item 3, which defines the limits of that authority. |
| 7 | Retention and disposal | Soft archive only, no automatic purge. No permanent deletion until a written retention schedule is adopted. Legal holds always stop disposal. | Safe launch | As built: nothing can be deleted. |
| 8 | Where documents live | Supabase private evidence bucket as system of record. Deny public access, signed short-lived links, log views and downloads, encrypt in transit and at rest, tested backups. | Approve | Private bucket and 60-second signed links were already in place. New: every document view is logged (who, which document, when) in an insert-only log the director can read in Settings. Encryption is the hosting platform's; backups are on the go-live gate. |
| 9 | Child records | Do not upload full child records at initial launch. Checklist indicators only. Keep the feature off until a separate privacy review, field list, role matrix, parent notice and retention rule are approved. | Approve | As built: off by default and enforced by the database. |
| 10 | Sender domain | A verified SquareOne-owned domain, display name "SquareOne ELC Compliance", monitored SquareOne reply-to. Keep reminders off until SPF, DKIM and DMARC pass. Never a personal account. | Action | Display name and `EMAIL_REPLY_TO` are implemented. The domain itself is information-needed item 4. |

### Questions A to F

| # | Question | Director's answer | Status | In the build |
|---|---|---|---|---|
| A | Missing blueprint | Must be committed as `docs/BLUEPRINT.md`. BUILD.md may guide development temporarily but is not a substitute. Production go-live stays blocked until it is present and reviewed. | Required | **Still missing.** Not supplied yet. |
| B | Status after rejection and corrected re-upload | The newer upload reads `pending_review`; the rejection stays in the history. | Approve | As built. |
| C | Who may draft library entries | The director and designated admin support may create and edit drafts. Only the director may publish, activate, retire or change an official version. | Approve | Implemented: a "May draft library entries" grant on admin support accounts, enforced by RLS. |
| D | Classroom reviewer access to names | Yes: names assigned to that classroom and a present/missing indicator only. No documents, dates, reasons, medical details or other classrooms. | Approve | As built. |
| E | Phase 5 and integrations | Only after hosted Phase 0 checks pass, decisions 1 to 10 are implemented, role tests pass with real test accounts, backup and restore is tested and the director signs off. | Defer | Not built. |
| F | Educator-entered checks and training | Yes, for their assigned classroom and their own training, pending until reviewed. | Approve | As built. |

### Implementation decisions review

Accepted as built: security and access, evidence and deadlines, authentication and invitations,
email privacy. Three carried conditions or changes:

- **Brand colors (change):** the approved palette is navy `#26384A`, sage `#879B82`, warm beige
  `#E9DDC8`, slate `#66717A` and cream `#F7F3EA`. Implemented in `src/app/globals.css`. Body text
  uses slightly darker shades of the navy and slate so small type keeps its contrast.
- **Authority labels (conditional):** the neutral seed labels are for development only. Settings,
  Setup now lets the director replace them with verified official names and links.
- **Overview and testing, phase order (conditional / gate):** the same test suite must run against
  hosted Supabase, and the hosted Phase 0 exit checks must pass, before production approval.

### Information needed before real-data go-live

| # | Item | State |
|---|---|---|
| 1 | Upload and verify the current DHS license showing the approved capacity | A license copy showing capacity 95 was supplied. To do on production: enter 95, upload it as evidence, director confirms it is the current license. |
| 2 | Upload the APPLE certificate; confirm the exact expiration and annual-report invoice date | Open. The document supplied is the offer of candidacy, not the certificate. |
| 3 | Name the temporary backup reviewer and document the limits of that authority | Open. |
| 4 | Confirm the official SquareOne sender domain and monitored reply-to address | Open. |
| 5 | Adopt a written retention and disposal schedule before permanent deletion is enabled | Open. Deletion stays disabled. |

### Official sources named in the answers (checked by the director's office on 2026-11-24)

Enter these in the library when activating; the build does not seed them.

- Licensing Requirements for Child Care Programs, Pub. 14-05, effective 11-1-2025:
  https://oklahoma.gov/content/dam/ok/en/okdhs/documents/okdhs-publication-library/14-05_LicensingRequirementsforChildCarePrograms_ccs_07312025.pdf
- Child Care Centers 5 Star Level Overview (criteria effective 6-1-2022):
  https://oklahoma.gov/content/dam/ok/en/okdhs/documents/okdhs-pdf-library/child-care-services/qris/ChildCareCenters5StarLevelOverview_ccs_11072022.pdf
- Child Care Rules and Feedback (later accreditation requirement for 5-Star programs):
  https://oklahoma.gov/okdhs/services/adult/ccsubsidy/rulesandfeedback.html
- CECPD Professional Development Ladder (PDL):
  https://cecpd.org/Provider-Programs/Oklahoma-Professional-Development-Registry-OPDR/Professional-Development-Ladder-PDL
- APPLE Accreditation FAQ: https://appleaccreditation.org/faq/
- FACCM / APPLE membership and annual reporting terms:
  https://members.appleaccreditation.org/ap/Membership/Application/vrAZlmp2

Operating principle from the answers: use the minimum information needed, default to restricted
access, preserve the audit trail, and require a second verification step before any deadline,
role or official rule becomes active. No dashboard status replaces the original license,
credential, certificate or accrediting record.

## Implementation decisions made during the build

| Date | Decision | Why |
|---|---|---|
| 2026-11-24 | `src/proxy.ts` instead of `src/middleware.ts` | Next.js 16 renamed the convention and deprecated `middleware.ts`. Same behavior. |
| 2026-11-24 | UI components in `src/components/ui` are hand-written in the shadcn style | The shadcn registry was not reachable from the build environment. Same dependencies (cva, Radix Slot, tailwind-merge), so `shadcn add` output can replace them. |
| 2026-11-24 | `profiles.child_health_access` boolean | Section 6: admin support sees `child_health` files only "unless granted". This is the grant. Only a director can set it. |
| 2026-11-24 | `credentials.eligibility_status` (`eligible` / `ineligible` / `pending`) | Section 5: background checks are stored as eligibility status, verification date and verifier only. Verification date and verifier reuse `verified_at` and `reviewer_id`. |
| 2026-11-24 | On draft versions `frequency`, `recurrence_rule` and `criticality` may be empty; an active version must have `frequency`, `criticality` and a director `reviewed_by` | Seeding a frequency or criticality for an unconfirmed rule would be inventing it (rule 1). |
| 2026-11-24 | New profiles are inactive unless a server-side invitation set a role in `app_metadata` | Default deny. `user_metadata` is user-editable and is never trusted. |
| 2026-11-24 | New evidence defaults to access class `restricted` | Default deny: a missing class must not make a document widely readable. |
| 2026-11-24 | No-hard-delete and insert-only audit are triggers, not only missing policies | They must hold for the service role too (rules 6 and 9). |
| 2026-11-24 | `reminder_events.due_date` column added | The unique index in section 5 names it. |
| 2026-11-24 | Brand palette is navy, sage, warm beige, slate and cream (replaced the admiral-blue-only choice) | Director's answers. Set once in `src/app/globals.css`. |
| 2026-11-24 | The supplied license and candidacy letter are not committed to the repository | They are real SquareOne records. They belong in the private evidence bucket on the production project, uploaded by the director. |
| 2026-11-24 | The 90-day reminder now goes to every dated item, not only major renewals | The approved schedule lists 90 days as standard; the 120-day notice is the one reserved for critical items. |
| 2026-11-24 | A document view is refused if it cannot be logged | Decision 8: views are logged. |
| 2026-11-24 | Phases 1 to 4 were built before the Phase 0 exit check on Vercel | The owner asked to build the whole app through to testing with real logins. The exit checks were run against a local Supabase stack instead; the hosted checks remain on the go-live gate. |
| 2026-11-24 | A renewal is: approve new evidence on an already-verified recurring item. The old cycle closes with its evidence, a new cycle opens with the next due date, and the approved submission belongs to the new cycle | Keeps prior evidence with its cycle and keeps the item verified through the handover (BUILD.md acceptance test). |
| 2026-11-24 | The next due date is computed by `src/lib/domain/deadlines.ts` from the version's recurrence rule and passed to the database function `review_evidence_link` | Rule 11: deadline math is a pure, unit-tested function. With no rule, no date is generated. |
| 2026-11-24 | New items are opened with no due date | Rule 1: a first deadline is set by a director or by a review decision, never assumed. |
| 2026-11-24 | Credentials carry reminders too (`reminder_events.credential_id`) and count in the Overdue and Due in 30 days cards | Acceptance test: "a credential due in 30 days ... produces exactly one scheduled notice". |
| 2026-11-24 | A rejection email does not contain the correction note | Rule 8. The note is free text; the email links to the item instead. |
| 2026-11-24 | Email templates are plain escaped HTML in `emails/templates.ts`, not React Email | `@react-email/components` is deprecated on npm. Same content rules. |
| 2026-11-24 | Invitations use a one-time link generated by the app (or a temporary password), not Supabase's built-in invitation email | The built-in email lands on a page a server-rendered app cannot read without editing Supabase's email template. |
| 2026-11-24 | Supabase Auth writes a new user's `app_metadata` in a second statement, so migration 0015 applies the role the first time it appears | Found by running against the real Auth service. Later metadata changes never re-activate a profile. |
| 2026-11-24 | Child records are behind a `child_records_enabled` setting, off by default and enforced by a database trigger | Open decision 9. |
| 2026-11-24 | Auditor packets are scoped to one authority's requirements and the evidence already approved for them, for 1 to 30 days | Section 6: read-only, only inside an unexpired grant. |
| 2026-11-24 | Readiness areas on the Overview are DHS, STARS, APPLE, Staff, Child files and Safety; an item can count in more than one area | Section 8 lists these areas. The "All items" row counts each item once. |
| 2026-11-24 | Local and CI database tests run on plain Postgres with stand-ins for Supabase's `auth` and `storage` schemas; tests are SQL scripts, not pgTAP | Fast and needs no Docker. The same SQL suite and the Playwright suite also run against the real Supabase services in `supabase/local`. Re-run against the hosted project before go-live (see RUNBOOK). |
| 2026-11-24 | Authority names in the seed are neutral labels | BUILD.md marks the official sources as "not checked". |
