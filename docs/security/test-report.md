DRAFT - REVIEW BY QUALIFIED security tester

# TalentBridge — Security Test Report (Code Review)

| | |
|---|---|
| **Project** | TalentBridge (job recruitment + applicant tracking), repo `job-recruitment-and-applicant-tracking-app` |
| **Date** | 2026-11-15 |
| **Scope** | Authentication & sessions; authorization & admin routes; Row Level Security across all migrations (0001–0017); file uploads & storage; chatbot endpoint; cron & API routes; rate limiting; service-role/secrets handling; public forms & input handling; platform settings & misc. |
| **Method** | **Code review only** — application source, server actions, route handlers and SQL migrations were read and cross-checked. **No live penetration testing was performed, the live website was not probed, and no authenticated-session (logged-in) testing was performed.** Where a finding depends on deployed configuration (e.g. database grants), that dependency is stated and the item is marked as needing verification against the live project. |
| **Reviewer role** | Security Tester, TalentBridge Launch Team (Phase 1, item 18). **No fixes have been applied** — this report recommends; the founder approves before any fix. |

## Summary of findings

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 4 |
| Medium | 6 |
| Low | 3 |
| Info | 3 |
| **Total** | **16** |

The platform's server-side authorization architecture is genuinely strong (see "What looked solid"). The serious findings cluster in one place: **direct database access via the public anon key** — Row Level Security policies and defaults that let any signed-in (or even anonymous) user bypass the careful checks the app code performs. The app code checks everything; the database layer sometimes lets people walk around it.

---

## High findings

### SEC-01 — `rate_limit_hits` table has no Row Level Security at all

- **Severity:** High
- **Area:** Row Level Security / rate limiting
- **Evidence:** `supabase/migrations/0011_rate_limit.sql:3-12` — the migration creates `public.rate_limit_hits` and comments *"No RLS policies: only accessed via service_role from server code"*, but it never runs `alter table … enable row level security`. It is the **only one of the platform's 50 tables** without RLS enabled (the other 49 all have it), and no migration contains any `REVOKE` restricting the table. On a standard Supabase project, new public-schema tables receive data grants for the `anon` and `authenticated` roles, and the anon key is public by design (it ships in every browser).
- **Impact:** Anyone can call the database directly with the public anon key and: **read** the table (leaking which IP addresses and user IDs are being rate-limited, and when); **insert** fake hits (e.g. five fake `login` hits for a victim's IP locks that IP out of login; twenty fake `apply` hits blocks a candidate from applying for a day); or **delete** rows to silently switch off rate limiting for the whole platform — including the login brute-force protection. The table that exists to stop abuse is itself abusable.
- **Recommended fix (not applied):** Enable RLS on `rate_limit_hits` with **no** policies for `anon`/`authenticated` (service role bypasses RLS, so server code keeps working), and/or explicitly `REVOKE ALL` on the table from `anon` and `authenticated`. Verify the live project's grants for this table in the Supabase dashboard as part of the fix.

### SEC-02 — Employer "Verified" status can be forged directly in the database (RLS column bypass)

- **Severity:** High
- **Area:** Row Level Security / authorization
- **Evidence:** `supabase/migrations/0007_rls.sql:86-87` — `create policy organizations_insert on public.organizations for insert to authenticated with check (true);` (comment: employer self-service signup). `supabase/migrations/0007_rls.sql:88-93` — `organizations_update_admin` lets an `org_admin` update their organization row checking only their role. The `organizations` table (`supabase/migrations/0001_identity.sql`, table definition) has trust columns `verification_status` (default `'unverified'`) and `account_status` (default `'active'`). RLS policies restrict **which rows** a user can touch, not **which columns** — and no trigger or column-level grant anywhere in the migrations stops a caller from setting these columns (the only triggers on the table are `set_updated_at`).
- **Impact:** TalentBridge's core promise is *verified, honest employers*, and the public site displays verification status (`organization_public_profiles` view, `0007_rls.sql:101`). Yet any signed-in user — a free candidate account takes under a minute to create — can insert an organization row directly via the database API with `verification_status = 'verified'` pre-set, never going near the control-center verification queue. Equally, a real `org_admin` whose company was **rejected or suspended** by the platform can set their own `verification_status` back to `'verified'` and `account_status` back to `'active'`. Platform moderation of employers is bypassable.
- **Recommended fix (not applied):** Keep the self-service insert, but make the trust columns server-controlled: e.g. a `BEFORE INSERT OR UPDATE` trigger that forces `verification_status`/`account_status` to safe values unless the caller is a super admin (or the write comes through the service role), or revoke column-level `UPDATE`/`INSERT` on those two columns from `authenticated`. Route organization creation through a server action that sets the status explicitly, as a second layer.

### SEC-03 — The super-admin (control center) login does not use the app's brute-force rate limit

- **Severity:** High
- **Area:** Authentication
- **Evidence:** The public login is rate-limited: `app/(public)/login/actions.ts:38` — `checkRateLimit("login", ip, 5, 60)`. The control-center login does not go through that action: `app/(admin)/control-center/login/AdminLoginForm.tsx:43` signs in **client-side** with `supabase.auth.signInWithPassword(...)` directly against Supabase Auth, and the follow-up server check `app/(admin)/control-center/login/actions.ts` (`verifyAdminLogin`, whole file) performs no rate limiting. The admin email address has also appeared in older project artifacts, so it should be treated as known.
- **Impact:** The single most powerful account on the platform — the super admin who can verify/suspend employers and export all user data — is the one login an attacker can password-guess against without tripping the app's own 5-attempts-per-minute limit. Only Supabase's platform-level limits stand in the way, and those are outside the app's control and visibility.
- **Recommended fix (not applied):** Route the control-center sign-in through a server action that applies the same `checkRateLimit("login", …)` (or a stricter `admin_login` bucket) before attempting the password sign-in, or add rate limiting inside `verifyAdminLogin` keyed by IP — noting the password attempt itself happens before that call, so the server-action route is the robust option.

### SEC-04 — `auto_pause_stale_jobs()` can be invoked anonymously via database RPC, with a caller-chosen threshold

- **Severity:** High
- **Area:** Cron & API routes / Row Level Security (function privileges)
- **Evidence:** `supabase/migrations/0012_ghost_job_accountability.sql:32-36` and `supabase/migrations/0017_auto_pause_fairness.sql:26-30` define `public.auto_pause_stale_jobs(inactivity_days int)` as `SECURITY DEFINER`. PostgreSQL grants `EXECUTE` on new functions to `PUBLIC` by default, Supabase exposes public-schema functions as RPC endpoints, and **no migration revokes execute** on this function (no `REVOKE` statements exist in the migrations at all). The cron route's secret check (`app/api/cron/auto-pause/route.ts:16`) guards only the HTTP path — the RPC path goes around it. The `inactivity_days` argument is supplied by the caller and is not validated.
- **Impact:** Anyone holding the public anon key (i.e. anyone) can call this function directly. With the default threshold they can trigger tonight's auto-pause early; with `inactivity_days = 0` the fairness rule in 0017 (`coalesce(last_employer_activity_at, published_at, created_at) < now() - 0 days`) matches **essentially every published job on the platform** — one unauthenticated request can empty the public job board. This is the same end-state as the accidental November auto-pause incident, except deliberate and repeatable at any time.
- **Recommended fix (not applied):** `REVOKE EXECUTE ON FUNCTION public.auto_pause_stale_jobs(int) FROM PUBLIC, anon, authenticated;` (the cron route and control center call it through the service role, which is unaffected). Apply the same review to the other `SECURITY DEFINER` functions (see SEC-16 note and "What looked solid" — the read-only role helpers are low-risk, but execute grants should be deliberate, function by function).

---

## Medium findings

### SEC-05 — Cron endpoint fails open when `CRON_SECRET` is not set

- **Severity:** Medium
- **Area:** Cron & API routes
- **Evidence:** `app/api/cron/auto-pause/route.ts:13-18` — `if (cronSecret && authHeader !== \`Bearer ${cronSecret}\`)` returns 401 **only when the secret exists**; if `CRON_SECRET` is unset, the check is skipped and the job runs for anyone who asks (both `GET` and `POST` are exported, line 64: `export const POST = GET`). `CRON_SECRET` is also absent from the validated environment schema in `lib/env.ts:20-37`, so nothing warns at boot when it is missing.
- **Impact:** A deployment that forgets one environment variable silently exposes an unauthenticated endpoint that pauses jobs with the service-role client and writes audit entries. SEC-04 is the worse path to the same function, but this one is a one-line configuration slip away at every redeploy.
- **Recommended fix (not applied):** Fail closed — return 500/401 when `CRON_SECRET` is not configured — and add `CRON_SECRET` to the env schema so a missing value is loud at startup.

### SEC-06 — Users can rewrite admin-controlled columns on their own profile (`is_active`, `phone_verified`, `email`)

- **Severity:** Medium
- **Area:** Row Level Security
- **Evidence:** `supabase/migrations/0007_rls.sql:62-64` — `create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid())`. Row-level only: every column is writable, including `is_active` and `email` (`supabase/migrations/0001_identity.sql`, profiles definition) and `phone_verified` / `phone_verified_at` (added by `supabase/migrations/0013_candidate_verification.sql`).
- **Impact:** Three concrete abuses, all via a direct database call with the user's own session: (1) **Self-reactivation** — a user suspended by the control center (`is_active = false`) can set it back to `true` themselves. (2) **Self-verification** — a candidate can set `phone_verified = true` without ever receiving an OTP, minting a trust signal the platform presents as checked. (3) **Invitation theft chain** — invitation acceptance checks that the signed-in user's *profile email* matches the invited email (`app/(public)/invite/[token]/actions.ts:99-109`); because `profiles.email` is user-writable through this policy, anyone who obtains an invitation link (they get forwarded) can first change their profile email to the invited address, then accept an invitation — including a privileged org role — that was never meant for them.
- **Recommended fix (not applied):** Restrict the columns a user may update on their own profile (column-level grants, or a trigger that rejects changes to `is_active`, `phone_verified`, `phone_verified_at`, `email` unless via the service role), and make invitation acceptance compare against the **auth** user's email (`auth.users` / session email) rather than the writable profile row.

### SEC-07 — User suspension is not enforced anywhere in the sign-in/session path

- **Severity:** Medium
- **Area:** Authentication & sessions / authorization
- **Evidence:** Suspending a user only writes a flag: `app/(admin)/control-center/users/actions.ts:136` — `.update({ is_active: false })` on `profiles`. A search of the session path finds **no read of `profiles.is_active`**: not in `lib/auth.ts` (`getSessionUser`/`requireSessionUser`), not in `middleware.ts`, not in the global role checks in `lib/rbac.ts` (`isSuperAdmin`, `isCandidate`), and not in the candidate guard. The only reads of the flag are the control center's own display/export pages.
- **Impact:** The control center shows a user as "suspended", but that user can keep signing in and using the candidate/employer portals exactly as before (org access depends on *membership* `is_active`, which suspension does not touch). An admin control the founder believes works does not — and combined with SEC-06, even the flag itself can be flipped back by the suspended user.
- **Recommended fix (not applied):** Enforce the flag centrally — e.g. check `profiles.is_active` in `requireSessionUser`/`getSessionUser` consumers or in the role helpers — and decide explicitly whether suspension should also deactivate memberships and/or ban the auth user via Supabase Auth admin APIs.

### SEC-08 — Any signed-in user can forge audit-log entries

- **Severity:** Medium
- **Area:** Row Level Security / platform integrity
- **Evidence:** `supabase/migrations/0007_rls.sql:142-143` — `create policy audit_logs_insert on public.audit_logs for insert to authenticated with check (true);` The comment says direct inserts are allowed "so request-scoped clients can log too", but the app's audit writer (`lib/audit.ts`, `writeAudit`) uses the **service-role** client, which bypasses RLS — no application code path needs this policy. There are deliberately no update/delete policies, so forged rows, once inserted, cannot be cleaned up through the API either.
- **Impact:** Any authenticated user can insert audit rows claiming any `actor_user_id` and any action (e.g. fake "user.suspended" or "organization.verified" entries) directly via the database API. The audit trail — which the control center displays and the anomaly alerts (`lib/audit-alerts.ts`) reason about — can be poisoned with believable fake history, undermining exactly the tool used to investigate real incidents.
- **Recommended fix (not applied):** Drop the `audit_logs_insert` policy for `authenticated` (service-role writes are unaffected), or constrain it with `with check (actor_user_id = auth.uid())` if a genuine request-scoped use appears.

### SEC-09 — One of the two CV upload paths skips the project's own file-content validation

- **Severity:** Medium
- **Area:** File uploads
- **Evidence:** The project has a purpose-built validator — magic-byte sniffing plus extension/content agreement — in `lib/uploads.ts:36-99` (`sniffDocMime`, `validateDocUpload`), used by the resume action (`app/(candidate)/candidate/resume/_actions.ts:74`) and covered by adversarial tests in `tests/uploads-security.test.ts` (fake PDF headers, spoofed content, oversized files, path randomisation). The other upload path, `app/api/candidate/cv-upload/route.ts`, does **not** use it: it trusts the client-supplied MIME type (`route.ts:44-48`, `ALLOWED_TYPES.includes(file.type)`), additionally allows `text/plain` and legacy `application/msword` (lines 8-14), and has no rate limit. The uploaded file is stored in the private `cvs` bucket and becomes the candidate's current CV (`route.ts:90-115`), which employers later download through signed URLs.
- **Impact:** A file that merely *claims* to be a PDF (or is an arbitrary text/binary file) is accepted, stored, parsed server-side by `lib/cv-parser.ts`, and later distributed to employers as the candidate's "CV". This defeats a security control the project deliberately built and tested, on exactly the path that handles the most sensitive documents on the platform.
- **Recommended fix (not applied):** Run the same `validateDocUpload` magic-byte validation in the cv-upload route (reading the file's head bytes, as the resume action does), align its allowlist with `lib/uploads.ts` (PDF/DOCX), and add the `apply`-style rate limiting used elsewhere.

### SEC-10 — No rate limiting on registration, password reset, or the contact form

- **Severity:** Medium
- **Area:** Rate limiting / public forms
- **Evidence:** `checkRateLimit` is used for login, apply, invites, feed and chat (see "What looked solid"), but a full read of the following files shows **no** rate-limit call: `app/(public)/register/actions.ts`, `app/(public)/forgot-password/actions.ts`, `app/(public)/contact/actions.ts`. All three are reachable by anonymous visitors.
- **Impact:** (1) **Registration** — scripted mass sign-ups create unlimited free accounts, each of which can immediately exercise the signed-in-user weaknesses above (SEC-02, SEC-08) and spam the feed within its per-user limits by rotating accounts. (2) **Password reset** — repeated reset emails can be triggered for a victim's address (Supabase's own email sending limits blunt this, but the app adds nothing and gets no signal). (3) **Contact form** — unlimited submissions land in the database and generate an in-app notification to *every* super admin per message (`app/(public)/contact/actions.ts:44-58`), a cheap way to flood the admin's notification feed.
- **Recommended fix (not applied):** Add IP-keyed `checkRateLimit` calls in the same style as login (e.g. register 5/hour/IP, reset 3/hour/IP+email, contact 5/hour/IP). A CAPTCHA is **not** recommended at this stage (paid/privacy trade-offs); rate limits plus the existing Zod validation are proportionate.

---

## Low findings

### SEC-11 — The rate limiter fails open when its database check errors

- **Severity:** Low
- **Area:** Rate limiting
- **Evidence:** `lib/rate-limit.ts:39-45` — on a database error the limiter logs and returns `{ allowed: true }` ("Fail open on DB error (don't block legitimate users if table missing)").
- **Impact:** A deliberate, documented trade-off — but it means any outage or corruption of the `rate_limit_hits` table silently disables *all* brute-force and spam limits, including login, with only a console error as the signal. Given SEC-01 (the table is writable by attackers), an attacker does not need an outage — they can aim for the error path.
- **Recommended fix (not applied):** Keep fail-open for low-risk buckets if desired, but fail **closed** (or fall back to a small in-memory allowance) for the `login` bucket, and surface limiter errors to the audit/anomaly channel rather than only `console.error`.

### SEC-12 — Internal error details are returned to clients in a few endpoints

- **Severity:** Low
- **Area:** API routes / information disclosure
- **Evidence:** `app/api/candidate/cv-upload/route.ts:83-88` returns `` `Upload failed: ${uploadError.message}` `` and its catch-all returns the raw error message (lines 117-120); `app/api/cron/auto-pause/route.ts:41` returns the database `error.message` in the 500 body; `app/api/admin/organizations/route.ts:52-55` returns raw error messages to the caller.
- **Impact:** Database/storage error strings reveal schema and implementation details that help an attacker refine the direct-database attacks in SEC-01/02/06. Low on its own; worth tidying while those are fixed.
- **Recommended fix (not applied):** Log the detail server-side; return a generic message plus a correlation id to the client.

### SEC-13 — Platform settings are readable by every signed-in user

- **Severity:** Low
- **Area:** Row Level Security / platform settings
- **Evidence:** `supabase/migrations/0007_rls.sql:747-748` — `create policy platform_settings_select on public.platform_settings for select to authenticated using (true)`. Current keys are operational configuration (platform name, operating mode, `registration_open`, `employer_approval_required`, job moderation, limits — see `app/(admin)/control-center/settings/actions.ts`), not secrets.
- **Impact:** Any free account can read the platform's operating configuration, including which moderation/approval gates are switched on — useful reconnaissance for planning abuse (e.g. knowing employer approval is off). The bigger risk is future: this table is the natural place a developer might one day store something sensitive, and it is already world-readable to users.
- **Recommended fix (not applied):** Restrict the select policy to the specific keys the app must read client-side (or to super admins, serving public config through a view like `organization_public_profiles`), and adopt a rule that secrets never go in `platform_settings` — environment variables only.

---

## Info findings

### SEC-14 — IP-based rate limiting trusts the first `X-Forwarded-For` entry

- **Severity:** Info
- **Area:** Rate limiting
- **Evidence:** `lib/rate-limit.ts:74-79` — `getClientIp` takes `x-forwarded-for`'s first entry, falling back to `x-real-ip` / `cf-connecting-ip`.
- **Impact:** Correct on Vercel (the platform sets this header), but if the app is ever served behind a different proxy or directly, clients could spoof the header and rotate IPs to defeat every IP-keyed limit (login, chat). Noted so the assumption is explicit before any hosting change.
- **Recommended fix (not applied):** None needed on Vercel; document the assumption next to `getClientIp` and revisit if hosting changes.

### SEC-15 — Registration reveals whether an email address already has an account

- **Severity:** Info
- **Area:** Authentication / public forms
- **Evidence:** `app/(public)/register/actions.ts:88-94` returns *"An account with this email already exists"* with a field error. (By contrast, `app/(public)/forgot-password/actions.ts` deliberately always returns success to avoid the same leak.)
- **Impact:** Anyone can test whether a specific person has a TalentBridge account. A common, deliberate UX trade-off — recorded so it is a decision, not an accident. Low sensitivity for a public job platform where profiles are largely public by design.
- **Recommended fix (not applied):** None required; if it ever matters (e.g. Mode B private deployments), switch to a generic "check your inbox" flow.

### SEC-16 — Bootstrap/seed operational hygiene cannot be verified from code — verify manually

- **Severity:** Info (suspicion to verify, not a confirmed flaw)
- **Area:** Platform settings & misc
- **Evidence:** `scripts/bootstrap-admin.ts` is well built — CLI-only, requires `BOOTSTRAP_ADMIN_EMAIL`, demands the operator type the email to confirm, and refuses to run when a super admin already exists unless `--force` is passed with confirmation (lines 1-17, 72-80). `scripts/seed.ts:79-81` refuses to run unless `SEED_CONFIRM=yes`. There is intentionally **no** web route that creates a super admin (verified: no bootstrap/setup route exists under `app/`).
- **Impact:** None from the code. What code cannot show: whether `BOOTSTRAP_ADMIN_EMAIL` was actually unset in the production environment afterwards, as the script's own output instructs, and whether the script file is absent from any deployed artefact (it is not web-reachable in this repo's routing, so risk is minimal).
- **Recommended fix (not applied):** One manual check in the Vercel dashboard: confirm `BOOTSTRAP_ADMIN_EMAIL` is not set in Production. That closes the item.

---

## Areas reviewed with no findings

- **XSS:** no occurrence of `dangerouslySetInnerHTML` anywhere in `app/`, `components/` or `lib/` (grep-verified); all user content (posts, comments, messages, notification titles built from user input) renders through React's default escaping.
- **SQL injection:** all database access goes through the Supabase query builder / parameterised RPC arguments; no string-built SQL exists in application code.
- **Session handling:** standard Supabase SSR cookie flow (`lib/supabase/server.ts`, `middleware.ts`) with `auth.getUser()` revalidation server-side; no custom token handling.

## What looked solid

The founder should see that much of this platform was built to a genuinely careful standard:

- **Server-side authorization doctrine, consistently applied.** Middleware is explicitly redirect-only (`middleware.ts:1-15`), and every portal re-checks roles server-side: the control center via `adminContext()`/`adminPageGuard()` which re-read the `super_admin` grant fresh from `user_roles` on **every** call before constructing the service-role client (`app/(admin)/_components/admin-server.ts`); candidates via `requireCandidate()` (called by all 9 candidate action files); employers via `requireOrgRole()` with role ranks and active-membership checks (`lib/rbac.ts`).
- **The service-role key is properly caged.** `lib/supabase/admin.ts:1` uses the `server-only` import so a client bundle fails at build time; `lib/env.ts` validates configuration and never echoes secret values in errors; every admin-client caller found operates after its own authorization check.
- **Team-invitation privilege escalation was already found and fixed in code.** `app/(employer)/employer/team/actions.ts` ("SECURITY (M1)") prevents an `hr_manager` from inviting a higher-ranked role; invitations use UUID tokens (`0001_identity.sql:148`), expire, and acceptance requires the signed-in email to match the invited email.
- **Login (public) is done right:** 5 attempts/minute/IP rate limit, one generic error for bad credentials, verified-email handling, and safe-redirect validation (`app/(public)/login/actions.ts`). Password reset is deliberately anti-enumeration (`app/(public)/forgot-password/actions.ts:33-35`).
- **Control-center login ceremony:** a non-admin session is *destroyed* and the failure message never distinguishes "wrong password" from "not an admin" (`app/(admin)/control-center/login/actions.ts`); successful admin logins are audit-logged. The control center also refuses to suspend/revoke the **last active super admin** (`ensureNotLastActiveSuperAdmin`).
- **Private files are genuinely private.** `cvs`, `offer-docs` and `avatars` buckets are non-public; `cvs`/`avatars` storage policies are owner-folder-only and `offer-docs` has no direct-access policies at all (`supabase/migrations/0008_storage.sql:22-52`); downloads go through ownership-checked routes that mint **120-second** signed URLs (`app/(candidate)/candidate/resume/download/[documentId]/route.ts:34-46`, `app/(candidate)/candidate/applications/[applicationId]/documents/[docId]/route.ts:36-52`); object names are randomised UUIDs (`lib/uploads.ts:104-112`).
- **Upload validation (on the path that uses it)** sniffs magic bytes and requires extension/content agreement, with adversarial unit tests (`lib/uploads.ts`, `tests/uploads-security.test.ts`, `tests/uploads.test.ts`).
- **Anonymous exposure is deliberately narrow:** the public can read only published, unexpired jobs (`jobs_select_public`, `0007_rls.sql`) and a column-limited view of active organizations (`organization_public_profiles`); audit logs have **no** update/delete policies (append-only for non-service-role callers).
- **Feed actions authorise in code** — session required, org posting requires active membership, job attachments must be the org's own published jobs, deletes limited to author/super admin — and are rate-limited per user (`app/(public)/feed/_actions.ts`).
- **The chatbot endpoint is a model citizen:** 1,000-char message cap, history capped at 6 turns, 15 AI questions/hour/IP, the Groq key read only from a server-side environment variable and never logged (failures log only the error class), and it fails soft to a fixed fallback (`app/api/chat/route.ts:55-90`, `lib/chatbot/ai.ts:144-185, 227-244`).
- **CSV export is hardened:** formula-injection prefixing, RFC-4180 escaping, a 5,000-row cap, super-admin-only context, and an audit entry per export (`lib/csv.ts:23-38`, `app/(admin)/control-center/export/route.ts:241-244`).
- **SECURITY DEFINER helpers in 0001/0007 pin `search_path = public`** (e.g. `can_view_candidate`, `is_super_admin`), closing the classic definer-hijack hole there; the 0012/0017/0011 definer functions use fully-qualified table names in their bodies, though they omit the explicit pin (minor inconsistency worth aligning during the SEC-04 fix).

## Suggested order of fixes (for the founder's approval — none applied)

1. **SEC-04 + SEC-01** — one small migration each (revoke function execute; enable RLS on `rate_limit_hits`). Highest risk-reduction per line changed.
2. **SEC-02 + SEC-06** — one "sensitive columns" migration (trigger or column grants) covering organizations and profiles together.
3. **SEC-03 + SEC-05 + SEC-10 + SEC-11** — authentication/rate-limit hardening in app code.
4. **SEC-07 + SEC-08 + SEC-09 + SEC-12 + SEC-13** — enforcement and hygiene batch.
5. **SEC-14/15/16** — document, decide, and do the one manual dashboard check.

*End of report. Prepared 2026-11-15 by the Security Tester role, TalentBridge Launch Team — DRAFT for review by a qualified security tester before any fix is approved.*
