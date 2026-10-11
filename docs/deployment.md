# Deployment Guide

Beginner-friendly, step by step, for someone deploying TalentBridge for the
first time. Assumes you have a GitHub account, a Supabase account, and a
Vercel account (all free tiers are enough to start; see
`docs/free-tier-limits.md`).

> **Honesty first:** this guide tells you exactly which parts have never been
> tested against live services (auth emails, storage, RLS with real sessions,
> email sending). Follow it, then run the smoke tests in Step 6 — don't assume
> it works because the build passed.

---

## Step 1 — GitHub repo

1. Create a new repository on GitHub (public or private — private still gives
   you 2,000 free Actions minutes/month; public repos get unmetered Actions
   minutes).
2. In the workspace root, check `.gitignore` includes at least: `node_modules`,
   `.next`, `.env`, `.env.local`, `playwright-report/`, `test-results/`.
3. Commit and push the code:

```bash
git add .
git commit -m "Initial TalentBridge deploy"
git remote add origin git@github.com:<you>/job-recruitment-and-applicant-tracking-system.git
git push -u origin main
```

**Never commit** `.env` or anything containing `SUPABASE_SERVICE_ROLE_KEY`.
If a secret ever lands in git history, rotate it immediately in the Supabase
dashboard (service-role key) — don't try to "fix" history alone.

---

## Step 2 — Supabase project setup

1. Create a project at supabase.com (any region near your users; note that
   Supabase's free projects **pause after 7 days of inactivity** — the first
   request after a pause takes 10–30 seconds. Fine for dev, not for
   production).

### 2a. Auth — URLs and redirects

In the Supabase dashboard, go to **Authentication → URL Configuration**:

- **Site URL:** your production URL (e.g. `https://job-recruitment-and-applicant-tracking-system.vercel.app`).
- **Redirect URLs (allowlist):** add your production URL, e.g.
  `https://job-recruitment-and-applicant-tracking-system.vercel.app/**`, plus `http://localhost:3000/**` if
  you also develop locally against this project.

The reset-password flow (`/reset-password`, which exchanges the emailed
`code` via `exchangeCodeForSession`) and email confirmations will **fail
silently or loop** if the production URL is missing from this allowlist —
this is the most common "it worked locally but not in prod" cause.

- **Email provider settings:** under **Authentication → Providers → Email**,
  decide whether email confirmation is on. Supabase's built-in email service
  on the free tier is rate-limited (reported around 3–4 emails/hour —
  *confirm at signup*) and often lands in spam. For anything beyond smoke
  testing, configure custom SMTP (see `docs/email-setup.md`).

### 2b. Apply the migrations

Migrations live in `supabase/migrations/`, ordered `0001_identity.sql`
through `0010_contact_messages.sql`. Apply them in order:

- With the Supabase CLI: `supabase db push` (project linked first), or
- With the dashboard **SQL Editor**: paste and run each file in order.

What they create: identity/orgs/audit (`0001`), job catalog (`0002`),
candidate data (`0003`), applications + stage-transition trigger (`0004`),
hiring (`0005`), config/notifications/settings (`0006`), **RLS policies on 45
tables** (`0007`), storage buckets + policies (`0008`), idempotent reference
seed (`0009`), contact messages (`0010`).

You can sanity-check locally first with `npm run db:validate` (throwaway
PostgreSQL cluster + functional checks — no Supabase needed).

### 2c. Storage buckets

Migration `0008_storage.sql` creates the buckets, but verify in
**Storage** that all four exist with the intended visibility:

| Bucket      | Visibility | Purpose |
| ----------- | ---------- | ------- |
| `cvs`       | **private** | Candidate CVs. Owner-only policy; staff get 2–10 min signed URLs generated server-side after an RBAC check. |
| `offer-docs`| **private** | Offer documents. Service-role only; signed URLs server-side. |
| `avatars`   | **private** | Profile avatars. Owner-only. |
| `org-logos` | **public read** | Organization logos (PNG/JPEG, 5 MB). Writes restricted to org admins of the org's folder. |

Do **not** flip `cvs`, `offer-docs`, or `avatars` to public — candidate PII
would become downloadable by URL. If you add new buckets later, default them
to private and open reads only via signed URLs.

### 2d. Seed (development project only)

`0009_seed.sql` runs automatically with the migrations (idempotent reference
data — safe anywhere). The **fictional dev dataset** (`npm run seed`) is for
non-production projects only:

```bash
SEED_CONFIRM=yes npm run seed
```

Seeded orgs are suffixed "(Fictional — Seed Data)". Never seed production —
the data is fictional and could confuse real users.

---

## Step 3 — Environment configuration

Copy `.env.example` to `.env` locally; in Vercel, set these in
**Project → Settings → Environment Variables** (Production; optionally
Preview/Development):

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Public; safe in browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public; safe in browser |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server-only.** Never add `NEXT_PUBLIC_` prefix. `lib/supabase/admin.ts` imports `server-only` so bundling it client-side fails the build. |
| `NEXT_PUBLIC_APP_URL` | yes | Production URL, e.g. `https://job-recruitment-and-applicant-tracking-system.vercel.app`. Used for email links/redirects. |
| `BOOTSTRAP_ADMIN_EMAIL` | bootstrap only | Used by `npm run bootstrap-admin`. |
| `RESEND_API_KEY` | optional | Without it, app emails never send (honest `sent:false` behavior — see `docs/email-setup.md`). |
| `EMAIL_FROM_ADDRESS` | optional | Sender address, e.g. `noreply@yourdomain.com`. |
| `SEED_CONFIRM` | optional | Must be exactly `yes` for `npm run seed` to run. |

`lib/env.ts` validates all of this with zod and fails fast at server boot —
a missing variable produces a named error, never a leaked secret.

---

## Step 4 — Bootstrap the first admin, then lock it down

1. In your Supabase dashboard (**Authentication → Users**), create the owner
   user (email + password; use "Auto Confirm" for the bootstrap user, since
   the built-in email service is rate-limited — see `docs/email-setup.md`).
2. Run from a machine with the production env vars (Vercel CLI or local):

```bash
BOOTSTRAP_ADMIN_EMAIL=owner@example.com npm run bootstrap-admin
```

   - Refuses if a `super_admin` grant already exists (needs `--force` +
     re-typed email to override).
   - You must **type the target email** to confirm — no blind grants.
3. Sign in at `/control-center/login`. The login page re-checks the
   `super_admin` grant fresh from `user_roles` on every attempt; non-admins
   get one generic "invalid" message (no distinction between bad credentials
   and non-admin — this is deliberate).
4. **Verify:** sign in with a normal candidate account and confirm it gets
   the generic "Access denied" screen on `/control-center`, `/control-center/users`,
   `/control-center/settings`, and that `/control-center/export` returns 403.
5. **Disable the bootstrap:** delete `scripts/bootstrap-admin.ts` and remove
   the `bootstrap-admin` npm script. Until you do, anyone with deploy-environment
   terminal access could grant themselves super admin.
6. Optional hardening: in the control center, create a second super admin and
   consider downgrading the first to a normal account so no single daily-use
   account holds the keys. (The app refuses to revoke the **last active**
   super admin — `ensureNotLastActiveSuperAdmin` — so you can't lock yourself
   out.)

**Known gap to be aware of:** suspending a user sets
`profiles.is_active=false`, but per-request session code does not currently
re-check `is_active`, so session revocation for suspended users must be done
in the Supabase dashboard (documented on the control-center Security page).
Sign-in for suspended users is blocked; this is a hardening gap, not a full
hole.

---

## Step 5 — Deploy to Vercel

1. In Vercel, **Add New → Project → Import** your GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Keep the defaults:
   - Build command: `next build` (`npm run build`)
   - Output directory: (default)
   - Install command: `npm install`
3. Add **all** environment variables from Step 3 (Production scope at minimum).
4. Deploy. The first build should succeed without real credentials for
   page-data collection: `lib/supabase/server.ts` awaits `cookies()` before
   reading env, opting pages into dynamic rendering so the build never needs
   to reach Supabase.

### Production checklist after the first deploy

- [ ] Set `NEXT_PUBLIC_APP_URL` to the real Vercel URL (not localhost).
- [ ] Add the Vercel URL to Supabase **URL Configuration** (Site URL +
      redirect allowlist) — see Step 2a.
- [ ] Re-run migrations against the production Supabase project if you only
      ran them on a dev project. (There is no auto-migration on deploy —
      this is deliberate; run them yourself and confirm.)
- [ ] Re-run the bootstrap against production, verify, and delete the script.
- [ ] Confirm `org-logos` is the only public bucket.
- [ ] Remember Vercel Hobby is **not for commercial use** and has no SLA —
      see `docs/free-tier-limits.md` before you put real users on it.

---

## Step 6 — Production smoke-test checklist

Do this on the live deployment with two browser profiles (or incognito
windows): one candidate user, one employer user, plus your admin.

**Public**
- [ ] Job search loads; filters (city, category, salary) narrow results; dead/expired/draft jobs never appear.
- [ ] Registration creates a candidate account; the "check your inbox" state is honest (no fake "sent" claim).
- [ ] Login redirects by role: `/control-center`, `/employer`, `/candidate`.

**Candidate**
- [ ] Profile CRUD saves; CV upload accepts PDF/DOCX ≤ 10 MB and rejects
      renamed executables (magic-byte check); deleting a CV blocked while an
      active application references it.
- [ ] Applying to a job: wizard completes, consent checkbox required,
      duplicate active application blocked with a friendly message.
- [ ] Withdraw works from a non-terminal stage; the application shows
      `withdrawn` in history.
- [ ] Privacy page: JSON export downloads; deletion request shows
      pending-review semantics (not "deleted").

**Employer**
- [ ] Job lifecycle: draft → pending_review → approved → published → paused →
      closed → archived; direct draft → published blocked when moderation is on.
- [ ] Kanban stage moves validate (only legal next stages offered); status
      history + audit rows written.
- [ ] Interview scheduling: conflict detection blocks overlapping bookings;
      completing advances the stage.
- [ ] Offer flow: approval required unless sender is org_admin/hr_manager;
      approver must differ from creator; salary visible only to
      org_admin/hr_manager.
- [ ] Team invites: token link works; email-must-match guard enforced.
- [ ] Reports CSV export is bounded and audit-logged.
- [ ] **Org isolation:** a user in Org A cannot see Org B's jobs, candidates,
      or applications (test with a second employer account). hiring_manager
      sees only assigned applications.

**Admin**
- [ ] `/control-center` metrics load; non-admin users get the generic access-denied screen (no org internals leaked).
- [ ] Org verification/suspension; user role grant/revoke; **last-admin guard**
      refuses to remove the final super admin.
- [ ] Candidate PII is masked by default; revealing it writes an audit row.
- [ ] Privacy request (deletion) cascades profile data but retains
      applications as hiring-org business records (stated in UI + audit).
- [ ] Audit logs show recent admin actions.
- [ ] Export downloads are bounded (5,000 rows) and audit-logged.

**Notifications**
- [ ] Stage changes, interviews, and offers produce in-app notifications for
      the candidate.
- [ ] With no `RESEND_API_KEY`: UI shows "email unconfigured"; `lib/email.ts`
      returns `{ sent: false }`; nothing claims an email was sent. (See
      `docs/email-setup.md`.)

---

## Rollback / recovery

- **Bad deploy:** Vercel keeps every deployment. In the dashboard, open the
  previous good deployment → **Promote to Production**. Instant, no data
  impact.
- **Bad migration:** migrations are additive by design (each `00NN_*.sql`
  applies cleanly to a fresh DB via `npm run db:validate`). There is no
  automated down-migration. If a migration breaks production, promote the
  previous Vercel deployment first (it talks to the same DB), then write a
  *new* corrective migration — never edit an applied migration file.
- **Compromised service-role key:** rotate it in Supabase
  (**Settings → API**), update the Vercel env var, redeploy. Audit
  `audit_logs` for suspicious admin actions in the window.
- **Suspended-abuse incident:** suspend the org/user in the control center,
  then revoke sessions in the Supabase dashboard (per-request `is_active`
  re-checks are a known gap — see Step 4).
- **Free-tier limits hit:** Supabase applies fair-use 402s when quotas are
  exceeded; Vercel Hobby pauses the project instead of billing. Neither pages
  you — set up your own monitoring. See `docs/free-tier-limits.md`.
- **Backups:** the Supabase free tier has no guaranteed backups (confirm at
  signup). Before launch, decide your backup story — at minimum, a scheduled
  `pg_dump` to your own storage, or upgrade to a plan with backups.
