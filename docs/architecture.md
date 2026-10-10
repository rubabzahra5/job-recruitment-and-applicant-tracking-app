# Architecture

System overview of Job Recruitment And Applicant Tracking System as built (Oct 2026). This describes what
the code actually does — for what was *not* yet verified against live
services, see the README.

## Route groups

Next.js App Router with four route groups, each with its own layout:

| Group | Prefix | Audience |
| ----- | ------ | -------- |
| `app/(public)/` | `/`, `/jobs`, `/companies`, `/login`, … | Everyone; job board + auth |
| `app/(candidate)/` | `/candidate/*` | Signed-in candidates |
| `app/(employer)/` | `/employer/*` | Org staff (recruiter+) |
| `app/(admin)/` | `/control-center/*` | Super admins only |

Shared server helpers live in per-group `_lib/` directories; client
components are colocated in `_components/`; server actions sit next to the
routes that use them (`actions.ts` / `_actions.ts` files).

**Rendering model:** pages are server components. `lib/supabase/server.ts`
awaits `cookies()` *before* reading env, which opts session-reading pages
into dynamic rendering — so `next build` never needs real credentials and
never bakes user data into static HTML.

## Request flow: server actions + RLS defense in depth

Every write goes through a server action (or route handler) that follows the
same pattern:

1. **Authenticate** — `requireSessionUser()` (`lib/auth.ts`).
2. **Authorize** — `lib/rbac.ts` (`requireOrgRole`, `requireOrgMembership`,
   `requireSuperAdmin`); roles are read **fresh from `user_roles` via the
   service-role client on every request** — never from client input, never
   from a cached claim.
3. **Scope** — every query carries `.eq("org_id", orgId)` / `.eq("user_id",
   user.id)`; resource actions re-load the row and verify ownership
   (`getOrgJob`, `getOrgApplication` pattern in the employer module).
4. **Only then** touch data with the service-role client.

`middleware.ts` is **redirect-only**: it sends unauthenticated visitors of
`/candidate`, `/employer`, `/control-center` to `/login`. It performs no
role checks and must never be relied upon for authorization.

Behind that, **RLS is the second wall** (migration `0007_rls.sql`, 45
tables): candidates see only their own rows; org staff see org-scoped rows
when membership is active and the role permits; anonymous users see only
published, non-expired jobs (+ public org fields via the
`organization_public_profiles` view, categories, locations). RLS guards
direct client queries; server code authorizes first because the service-role
client bypasses RLS.

## RBAC model — 7 roles

Two platform-wide (global) roles and five org-scoped roles (`lib/rbac.ts`):

| Role | Scope | Rank |
| ---- | ----- | ---- |
| `super_admin` | platform (org_id NULL) | ∞ — checked separately |
| `candidate` | platform (org_id NULL) | n/a |
| `org_admin` | organization | 5 |
| `hr_manager` | organization | 4 |
| `recruiter` | organization | 3 |
| `hiring_manager` | organization | 2 |
| `employee` | organization | 1 |

- Grants live in `user_roles` (unique on `(user_id, role,
  coalesce(org_id, zero-uuid))`); effective org roles additionally require
  an **active** row in `organization_memberships`.
- `requireOrgRole(userId, orgId, { atLeast: "recruiter" })` (or an explicit
  role list) enforces the rank ladder; `requireSuperAdmin` is control-center
  only. The control center's role matrix page (`/control-center/roles`)
  documents capabilities × roles.
- **Escalation guards:** employer team management blocks `super_admin`
  grants and protects the last org admin; the control center requires typed
  `GRANT SUPER ADMIN` to assign super_admin and refuses to revoke/suspend
  the last active super admin.

## Stage-transition enforcement (two layers)

Application pipeline moves are validated in **two independent places** so
neither can be bypassed:

1. `lib/pipeline.ts` — `loadPipeline()` loads `pipeline_stages` /
   `pipeline_transitions` from the DB; `assertValidTransition(from, to, …)`
   throws on illegal moves. Called by every server action that changes
   `applications.stage`.
2. The `validate_application_stage_transition` trigger on `applications`
   (migration `0004`) — enforces the same rules for direct SQL writes.

Rules: terminal stages (`hired`, `rejected`, `withdrawn`, `offer_declined`)
accept no outgoing moves; candidates may only move to `withdrawn` (and only
from non-terminal pre-offer stages); every move writes an
`application_status_history` row and an `audit_logs` entry.

## Storage strategy — private buckets + signed URLs

| Bucket | Visibility | Access pattern |
| ------ | ---------- | -------------- |
| `cvs` | private | Owner-only policy; staff get 2–10 min signed URLs generated **server-side after an RBAC check** |
| `offer-docs` | private | Service-role only; signed URLs server-side |
| `avatars` | private | Owner-only |
| `org-logos` | public read | Writes restricted to org admins of the org's folder |

Uploads go through `lib/uploads.ts`: 10 MB default cap, PDF/DOCX only,
magic-byte sniffing with extension/content agreement, randomized
`{bucket}/{user_id}/{uuid}.{ext}` paths (no guessable URLs, no filename
collisions). Staff never get direct bucket access to CVs — only
short-lived signed URLs minted after authorization.

## Notification architecture

`lib/notifications.ts` is the single choke point:

- `createNotification()` writes an in-app row to `notifications` and logs
  `notification_delivery_logs` (channel `in_app`, status `sent`).
- Email/SMS fan-out is **not** implicit: the code that actually sends
  (`lib/email.ts`) records its own delivery-log entries, so the log is one
  honest record of what was attempted per channel.
- Preferences live in `notification_preferences`; email templates in
  `email_templates` (CRUD in the control center).
- **Primary channel is in-app.** Email is best-effort via the optional
  Resend provider; when unconfigured, `sendEmail()` returns `{ sent: false,
  reason: "email_unconfigured" }` and the UI says so (see
  `docs/email-setup.md`).

## Settings consumption map

Settings are edited in `/control-center/settings` (zod-validated, every save
audited). Source of truth for the contract: `app/(admin)/control-center/settings/settings-spec.ts`.
Verified against the codebase 2026-10-10 — **consumed** vs **contract-only**:

| Setting | Status |
| ------- | ------ |
| `organization_settings.max_active_job_postings` | **Consumed** — enforced on publish (`app/(employer)/employer/jobs/actions.ts`) |
| `organization_settings.default_deadline_days` | **Consumed** — pre-fills job deadline (`jobs/actions.ts`) |
| `organization_settings.notify_recruiters_on_new_application` | **Consumed** — read via `app/(employer)/_lib/org.ts` (documented contract for application intake) |
| `platform_settings.employee_portal_enabled` | **Consumed** — gates `/employer/employee/*` server-side, 404 when off |
| `platform_settings.job_moderation_required` | **Consumed** — blocks direct draft→published when on (`jobs/actions.ts`) |
| `platform_settings.operating_mode` | Contract-only — displayed on the control-center dashboard; no route branches on centralized vs internal yet |
| `platform_settings.platform_name` | Contract-only — intended for header/footer/email templates; not read by routes yet |
| `platform_settings.currency` / `timezone` | `lib/format.ts` formats PKR (`Rs 85,000`, Pakistani digit grouping) and Asia/Karachi display with UTC storage; the settings keys are the contract for making these dynamic |
| `registration_open`, `employer_approval_required`, `max_active_applications_per_candidate`, `cv_max_file_mb`, `cv_allowed_types`, `data_retention_days`, `notify_on_new_application`, `notify_on_stage_change`, privacy/support contacts | Contract-only — honored by the settings UI contract; wire consumers before relying on them |

Rule for contributors: when you add a consumer for a contract-only setting,
update its `consumedBy` note in `settings-spec.ts`.

## Multi-tenancy guarantees

- **Org resolution choke point:** `app/(employer)/_lib/org.ts`
  `getOrgContext()` resolves the org only from **active**
  `organization_memberships`; a client-supplied `?org=` is accepted only for
  orgs the user actively belongs to (super admins may pass an explicit
  existing org id).
- **Query scoping:** every employer query is `.eq("org_id", orgId)`; resource
  mutations re-verify `row.org_id === ctx.orgId`.
- **Role scoping:** `hiring_manager` sees only applications with an
  `application_assignments` row for them ("assigned vacancies").
- **Candidate PII:** staff reads require `can_view_candidate()` semantics
  (applied to their org, or the candidate opted into searchability);
  internal notes (`application_notes.is_internal`) are never queried by the
  candidate module; candidate emails are never displayed in the employer
  portal; control-center PII is masked by default with audit-logged reveal.
- **Mode B (internal):** the same isolation machinery applies; the
  difference is operational (single org, registration/verification gates) —
  driven by `operating_mode` once routes consume it.

## Known limitations (don't work around silently — fix or document)

1. **Never tested against live Supabase** — auth flows, storage signed URLs,
   RLS with real sessions, and email sending are code-complete but
   unexecuted. First integration pass must be manual (see README).
2. **Suspension enforcement gap** — `profiles.is_active=false` blocks
   sign-in, but per-request code doesn't re-check `is_active`; revoke
   sessions in the Supabase dashboard after suspending.
3. **`platform_settings` consumers** — several keys are contract-only (table
   above); don't assume a setting takes effect until you've grepped for a
   reader.
4. **`organization_public_profiles` view** relies on view-owner RLS bypass —
   flagged for review when connecting the real project.
5. **Suspension-visibility contract** — suspending an org hides its jobs only
   if listing queries filter `organizations.account_status='active'`;
   audit metadata notes this; verify each listing path honors it.
6. **E2E** — Playwright specs exist (`e2e/smoke.spec.ts`) but couldn't run in
   the build sandbox (browser download blocked); re-run `npm run test:e2e`
   in a normal environment.
7. **Email unconfigured by default** — in-app notifications are the only
   guaranteed channel until Resend + Supabase custom SMTP are set up.
