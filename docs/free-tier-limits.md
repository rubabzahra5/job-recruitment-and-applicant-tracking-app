# Free-Tier Limits (researched Oct 2026)

Current free quotas for the three providers this project runs on. Researched
via web search on 2026-10-10; providers change terms without notice, so
**re-check at signup** — anything that could not be verified or where
sources conflict is labeled **"confirm at signup"**.

> **Disclaimer:** free tiers have **no SLA and no guarantee of permanence**.
> Every provider can change limits, add restrictions, or discontinue free
> offerings. Do not promise users uptime you don't control, and budget for
> the first paid tier before you need it.

## Supabase (free)

| Resource | Reported free limit |
| -------- | ------------------- |
| Database size | 500 MB |
| File storage | 1 GB |
| Bandwidth (egress) | 5 GB / month |
| Auth monthly active users | 50,000 |
| Edge Function invocations | 500,000 / month |
| Realtime concurrent connections | 200 |
| Realtime messages | 2 million / month |
| Projects | 2 active per organization |
| Compute | Shared (nano; ~0.25 vCPU, 512 MB RAM) |
| Log retention | 1 day |
| Backups | Not guaranteed on free (**confirm at signup**) |
| Built-in auth emails | ~3–4 / hour (**confirm at signup** — third-party guides vary; see `docs/email-setup.md`) |

**Pausing policy:** free projects with no API requests for **7 days** are
paused automatically. Data is retained, but the project goes offline until
manually resumed; the first request after a pause cold-starts in ~10–30s.
This alone rules out the free tier for anything user-facing in production.

**When limits are exceeded:** Supabase applies fair-use restrictions —
services return errors (reported as HTTP 402) until you upgrade or the
billing period resets.

**What this means for TalentBridge:** 500 MB database and 1 GB storage are
the binding constraints (CVs at up to 10 MB each fill 1 GB fast — ~100 CVs).
Plan the move to Pro ($25/month reported) before launch, or keep the pilot
tiny and monitored.

## Vercel (Hobby / free)

| Resource | Reported free limit |
| -------- | ------------------- |
| Bandwidth | 100 GB / month |
| Serverless function invocations | 100K / month (**conflicting reports** — some sources say 1M; **confirm at signup**) |
| Serverless function duration | 10 seconds max per invocation |
| Build execution | 6,000 minutes / month |
| Deployments | 100 / day |
| Concurrent builds | 1 |
| Custom domains | 50 (**confirm at signup** — reports vary) |
| Edge middleware invocations | 1M / month (**confirm at signup**) |
| Image optimization | 1,000 source images (**confirm at signup**) |
| Team members | 1 (owner only) |
| Log retention | 1 hour |
| **Commercial use** | **Not allowed on Hobby** |

**When limits are exceeded:** the site stops serving traffic (or functions
return errors) until the next billing cycle — there is no overage billing
because there is no payment method on file.

**What this means for TalentBridge:** the Hobby plan is fine for
development, demos, and a non-commercial pilot. **A production launch with
real employers and candidates is commercial use and requires Pro**
(~$20/user/month reported). Note TalentBridge is heavily server-rendered —
every page hit is a function invocation, so watch that meter first. Also
note: Pro itself carries no uptime SLA (SLAs are Enterprise-only per
reports — **confirm at signup**).

## GitHub (Free)

| Resource | Reported free limit |
| -------- | ------------------- |
| Repositories | Unlimited public and private |
| Actions minutes (private repos) | 2,000 / month (Linux ×1; Windows ×2, macOS ×10 multipliers) |
| Actions minutes (public repos) | Unmetered (free) |
| Actions artifact storage | 500 MB |
| Actions cache storage | 10 GB per repo |
| Scheduled workflows | Disabled after 60 days without repo activity (public repos; **confirm at signup**) |

**What this means for TalentBridge:** CI (typecheck, lint, unit tests) for
this repo costs a few minutes per run — 2,000 minutes/month is comfortable
for a private repo, and a public repo doesn't consume the quota at all.

## Resend (free) — optional email provider

3,000 emails/month with a **100/day cap** (the daily cap binds first), 1
verified domain, 30-day log retention, ~10 requests/second rate limit
(**confirm at signup**). See `docs/email-setup.md`.

## Monitoring checklist (all providers)

Free tiers don't page you. Before any pilot:

- [ ] Supabase dashboard: watch database size, storage, and egress weekly.
- [ ] Vercel dashboard: watch bandwidth and function invocations.
- [ ] Set a calendar reminder for the Supabase 7-day pause risk if the
      project is idle (dev projects) — or accept the cold start.
- [ ] Decide the paid-tier trigger *in advance* (e.g. "database > 350 MB" or
      "first real employer onboarded") and who approves the spend.

## Migration path off free tiers

If you outgrow the free tiers (or want guarantees they don't offer):

- **Database:** any managed Postgres works for the *data* layer — reported
  options include Neon, Railway, Render, AWS RDS, or self-hosted Postgres.
  **But** TalentBridge is coupled to Supabase beyond raw Postgres: Auth
  (users, sessions, email flows), Storage (buckets + signed URLs), and RLS
  helpers referencing `auth.uid()`. Migrating the database means
  re-platforming auth and storage too — budget for that, it's not a
  connection-string swap.
- **Hosting:** any Node.js host that runs `next build` / `next start`
  (VPS, Railway, Render, Fly.io — confirm current offerings at signup).
  You keep the same env-var contract (`.env.example`); you lose Vercel's
  preview deployments and zero-config setup.
- **Email:** Resend paid tier, or any SMTP provider via Supabase's custom
  SMTP settings (auth emails) — `lib/email.ts` is a provider interface, so
  swapping the implementation doesn't touch callers.

Whichever path you take, re-run the full smoke-test checklist in
`docs/deployment.md` against the new environment.
