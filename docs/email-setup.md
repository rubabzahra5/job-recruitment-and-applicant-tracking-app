# Email Setup

Two separate email concerns exist in Job Recruitment And Applicant Tracking System. They are configured
independently, and each one is **honest about whether it actually sends**.

## 1. Supabase Auth emails (verification, password reset)

Supabase sends its own emails for auth flows (email confirmation on
sign-up, password-reset links) from its built-in email service. This app
calls `supabase.auth.signUp` (`/register`), `resetPasswordForEmail`
(`/forgot-password`), and `auth.updateUser` for email changes — all of which
trigger Supabase-side emails that the app never sees.

**Limits you must know:**

- The built-in service on the free tier is heavily rate-limited (third-party
  guides report roughly **3–4 emails/hour** — *confirm at signup*; Supabase's
  own dashboard/docs are the authority). Repeated sign-up testing will hit
  "email rate limit exceeded". This is the tier, not a bug in this app.
- Deliverability is poor — these emails often land in spam. Never rely on
  them for a real launch.

**For development:** in the Supabase dashboard (**Authentication → Users**)
you can create test users with **Auto Confirm**, skipping the email
round-trip entirely. Or disable "Confirm email" under
**Authentication → Providers → Email** (dev projects only).

**For production:** configure custom SMTP (**Project Settings → Auth → SMTP
Settings**) with a transactional provider. Once custom SMTP is on, Supabase
uses it for auth emails and the built-in rate limits no longer apply
(confirm at signup).

## 2. Application emails via Resend (optional)

All *application* emails (offer notifications, interview invites, etc.) go
through the provider interface in `lib/email.ts`:

- `getEmailProvider()` returns a Resend implementation **only when both**
  `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` are set (checked by
  `isEmailConfigured()` in `lib/env.ts`).
- `sendEmail()` returns `{ sent: true, providerId }` on success.
- When unconfigured, it returns `{ sent: false, reason: "email_unconfigured" }`
  — **no request is attempted, and no code path may claim a send happened.**
- On provider failure it returns `{ sent: false, reason: "provider_error",
  detail }`.

The Resend implementation uses their REST API directly (`POST
https://api.resend.com/emails`) with no SDK dependency.

### Setting up Resend (optional, recommended before launch)

1. Sign up at resend.com and create an API key.
2. Verify a sending domain (add the SPF/DKIM records Resend gives you to
   your DNS). The free tier allows 1 verified domain.
3. Set the env vars:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
```

4. Redeploy / restart so `lib/env.ts` picks them up.

**Resend free-tier limits (reported as of Oct 2026 — confirm at signup):**
3,000 emails/month with a **100/day cap** (the daily cap is the binding
constraint), 1 verified domain, 30-day log retention. Paid starts at
$20/month for 50,000 emails. API rate limit: 10 requests/second.

## 3. The honest unconfigured behavior (the default)

When `RESEND_API_KEY` is not set — which is the default state of a fresh
deploy:

- **In-app notifications are the primary channel.** `lib/notifications.ts`
  writes to the `notifications` table and logs delivery
  (`notification_delivery_logs`, channel `in_app`, status `sent`). Every
  workflow (stage changes, interviews, offers, messages) notifies users
  in-app regardless of email configuration.
- **The UI says so.** The candidate notifications page (`/candidate/notifications`)
  shows an explicit warning that the email channel is unconfigured; the
  control-center notifications page (`/control-center/notifications`) shows
  an email-unconfigured banner; retrying a failed email delivery is
  **refused** with an explicit `email_unconfigured` status.
- **Delivery logs never lie.** `notification_delivery_logs` records what was
  actually attempted: an in-app notification marked `sent` means the row was
  written; an email marked anything else means the provider was contacted or
  explicitly not configured. Nothing in the codebase claims an email was
  delivered when it wasn't.

### What this means for you

- You can run, demo, and even pilot Job Recruitment And Applicant Tracking System with **zero email
  configuration** — users get in-app notifications, and every screen tells
  the truth about email.
- Before a real launch, configure Resend (app emails) **and** custom SMTP in
  Supabase (auth emails), or your users won't reliably receive confirmations,
  resets, offers, or interview invites.
- When triaging a "user didn't get the email" report, check
  `notification_delivery_logs` first: it distinguishes `email_unconfigured`
  from `provider_error` from `sent`.
