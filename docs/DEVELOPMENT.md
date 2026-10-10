# Development Guide

## Prerequisites

- Node.js ≥ 20.9
- A Supabase project (PostgreSQL + Auth + Storage)

## Setup

```bash
cp .env.example .env   # fill in your Supabase credentials
npm install
npm run dev            # http://localhost:3000
```

## Database

Migrations live in `supabase/migrations/` and are versioned `0001_…` → `0010_…`.
Apply them in order with the Supabase CLI (`supabase db push`) or the SQL editor.

To validate them locally without Supabase:

```bash
npm run db:validate
```

This spins up a throwaway PostgreSQL cluster (needs the `postgresql` system
package), stubs the Supabase-provided `auth` and `storage` schemas, applies
every migration in order, and runs row-count smoke checks.

## Authorization model

- `middleware.ts` only redirects unauthenticated users away from
  `/candidate`, `/employer`, `/control-center`. It performs no role checks.
- Every page and server action must authorize via `lib/rbac.ts`
  (`requireOrgRole`, `requireOrgMembership`, `requireSuperAdmin`) — roles come
  from the `user_roles` table, never from client input.
- RLS policies (`0007_rls.sql`) are defense-in-depth for direct client queries.
  The service-role client bypasses RLS, so server code must check first.

## Environment & build

- `lib/env.ts` validates configuration lazily and fail-fast: at server startup
  (`instrumentation.ts`) and on first request-time access. Error messages name
  variables only — secret values are never echoed.
- `lib/supabase/server.ts` awaits `cookies()` BEFORE reading env. This opts
  session-reading pages into dynamic rendering, so `next build` never needs
  real credentials. Do not reorder this.

## Pipeline stages

Application stage moves are validated in two places:

1. `lib/pipeline.ts` — `assertValidTransition()` in server actions.
2. The `validate_application_stage_transition` trigger on `applications` —
   protects direct SQL writes too.

Allowed transitions are data in `pipeline_transitions` (seeded); terminal
stages (`hired`, `rejected`, `withdrawn`, `offer_declined`) accept no outgoing
moves.

## Conventions

- Timestamps are stored in UTC (`timestamptz`); display converts to
  `Asia/Karachi` via `lib/format.ts`.
- Money is PKR, formatted as `Rs 85,000` via `formatPKR()`.
- Uploads: PDF/DOCX only, magic-byte sniffed, stored at
  `{bucket}/{user_id}/{uuid}.{ext}`.
- CSV exports: bounded (`exportScopedCsv`), RFC 4180 escaping, formula-injection
  neutralization.
- Email: `lib/email.ts` returns `{ sent: false, reason: 'email_unconfigured' }`
  when no provider is configured — never claim a send that didn't happen.
- Audit: append via `lib/audit.ts`; `audit_logs` is INSERT-only.

## Scripts

| Script | Notes |
| ------ | ----- |
| `npm run bootstrap-admin` | One-time super-admin grant. Typed email confirmation required. Refuses if a super admin exists (unless `--force` + typed confirmation). Disable/remove after use. |
| `npm run seed` | Fictional dev dataset. Requires `SEED_CONFIRM=yes`. Never auto-runs. |

## Further reading

- `docs/deployment.md` — production deployment, step by step
- `docs/architecture.md` — system overview (routes, RBAC, RLS, settings map)
- `docs/email-setup.md` — Supabase Auth emails + optional Resend; the honest unconfigured behavior
- `docs/compliance-pk.md` — launch checklist for qualified Pakistani legal/HR counsel (not a compliance claim)
- `docs/free-tier-limits.md` — current Supabase/Vercel/GitHub free quotas and migration paths
- `docs/SCHEMA.md` — database schema overview
