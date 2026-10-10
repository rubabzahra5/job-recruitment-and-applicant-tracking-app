# Database Schema Overview

Migrations: `supabase/migrations/0001_identity.sql` → `0009_seed.sql`.
All primary keys are UUIDs (`gen_random_uuid()`); all timestamps are
`timestamptz` (UTC); every private table has RLS enabled.

## Identity (0001)

| Table | Purpose |
| ----- | ------- |
| `profiles` | One row per auth user (`id` → `auth.users.id`) |
| `user_roles` | Role grants: `super_admin` / `candidate` (org NULL) or org-scoped roles. Unique on `(user_id, role, coalesce(org_id, zero-uuid))` |
| `organizations` | Employer organizations |
| `organization_memberships` | User ↔ org links (`is_active` gates effective roles). Unique `(org_id, user_id)` |
| `departments` | Org departments. Unique `(org_id, name)` |
| `organization_invitations` | Token-based staff invites |
| `audit_logs` | INSERT-only audit trail |

Helpers: `is_super_admin()`, `user_org_role(org)`, `user_has_org_role(org, roles[])`
(SECURITY DEFINER, used by RLS policies to avoid recursion).

## Catalog (0002)

`job_categories`, `locations` (province CHECK over Pakistan's provinces/territories),
`jobs` (full posting model: salary range with `salary_max >= salary_min` CHECK,
status workflow `draft → … → published`, generated `tsvector` search column with
GIN index), `job_questions`, `job_skills`, `job_approvals`.

## Candidates (0003)

`candidate_profiles` (`is_searchable` defaults to **false** — private by default),
`candidate_education`, `candidate_experience`, `candidate_skills`,
`candidate_certifications`, `candidate_documents`, `saved_jobs`
(unique `(user_id, job_id)`), `job_alerts`.

## Applications (0004)

`applications` (stage CHECK over the 13 pipeline stages; partial unique index on
`(user_id, job_id)` WHERE `withdrawn_at IS NULL`), `application_answers`,
`application_documents`, `application_status_history`, `application_assignments`,
`application_notes`, `candidate_messages`.
Stage moves are guarded by the `validate_application_stage_transition` trigger.

## Hiring (0005)

`interviews` (default timezone `Asia/Karachi`), `interview_participants`,
`interview_feedback` (rating 1–5, one row per reviewer per interview),
`offers` (status workflow), `offer_approvals`, `hiring_records`
(unique `application_id`).

## Config (0006)

`pipeline_stages` + `pipeline_transitions` (the stage machine),
`notifications`, `notification_preferences`, `notification_delivery_logs`,
`email_templates`, `platform_settings` (key PK), `organization_settings`,
`consent_records`, `privacy_requests`.

## RLS (0007)

- Candidates see only their own rows.
- Org staff see org-scoped rows when their membership is active and their role
  permits; candidate PII additionally requires `can_view_candidate()` (applied
  to their org, or the candidate opted into searchability).
- Anonymous users can SELECT only published, non-expired jobs (+ public org
  fields via the `organization_public_profiles` view, categories, locations,
  pipeline definitions).
- `audit_logs`: SELECT super-admin only; INSERT authenticated; no UPDATE/DELETE.
- `service_role` bypasses RLS — server code authorizes via `lib/rbac.ts` first.

## Storage (0008)

Buckets: `cvs` (private, owner-only), `offer-docs` (private, service-role only —
signed URLs server-side), `avatars` (private, owner-only), `org-logos` (public
read; writes restricted to org admins of the org folder).

## Seed (0009)

13 job categories, 13 Pakistani cities, the 13-stage pipeline with 27 allowed
transitions, and platform defaults (`operating_mode='centralized'`,
`currency='PKR'`, `timezone='Asia/Karachi'`, …). Idempotent.
