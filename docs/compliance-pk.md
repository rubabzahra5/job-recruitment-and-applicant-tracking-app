# Pakistan Launch Checklist — Legal & HR Review

> **This document is not legal advice and makes no claim of legal
> compliance.** It is a checklist of areas that **qualified Pakistani
> legal and HR counsel must review before launch**. The platform is software;
> whether its use is lawful depends on how you configure and operate it.

TalentBridge is built so that jurisdiction-specific rules are
**configuration, not code** — but configuration is still your
responsibility. Treat every section below as "discuss with counsel, then
configure."

## 1. Configurable labor settings (nothing hardcoded)

The following must be set by the platform owner and reviewed with counsel —
they are **not** baked into the code:

- **Minimum wage / salary floors.** `lib/format.ts` formats PKR amounts; it
  does not validate them. If you enforce minimum compensation on job posts,
  implement it as a validated `platform_settings` / `organization_settings`
  value (counsel: Pakistan's minimum wage is set by federal/provincial
  notifications and changes — confirm the current figure and which
  jurisdiction's notification applies to each posting location).
- **Jurisdiction.** Jobs span provinces/territories (`locations.province`
  CHECK covers Pakistan's 7 provinces/territories). Counsel should advise
  which provincial labor rules apply per posting.
- **Working-hours, overtime, and leave defaults** in offer templates —
  counsel to confirm against applicable standing orders / provincial law.

The settings editor (`/control-center/settings`) exists precisely for this;
adding a new labor rule as a setting is preferable to hardcoding it.

## 2. Privacy notice, consent records, and retention

What the platform already does (verify with counsel that it is sufficient):

- **Privacy notice:** `/privacy` documents collection, use, retention
  (24-month applications, 12-month contact messages, 30-day deletion), and
  deletion rights. Counsel must review the copy — it was written by
  developers, not lawyers.
- **Consent records:** the apply wizard writes a `consent_records` row
  (`purpose='job_application'`) on submit; candidates opt into searchability
  (`candidate_profiles.is_searchable`, default **false** — private by
  default). Counsel: confirm the consent wording and whether additional
  consents (e.g. background checks, reference checks) are needed before those
  features are used.
- **Retention/deletion workflows:** candidates can request export
  (JSON, CV bytes excluded — metadata only) and deletion via
  `/candidate/privacy` → `privacy_requests`. Deletion is **pending-review**,
  not instant; on approval the profile cascade-deletes (education,
  experience, skills, certs, documents) while applications are retained as
  hiring-organization business records. Counsel: confirm retention periods,
  the business-records carve-out, and the 30-day deletion commitment stated
  on the privacy page.
- **Data residency and sub-processors:** Supabase hosts the data (region
  chosen at project creation — counsel may care where), Resend processes
  email addresses if configured, Vercel serves the app. Maintain a
  sub-processor list and disclose it.

## 3. Fair-hiring guardrails

The platform deliberately collects the minimum: **CNIC, date of birth,
marital status, photo, and religion are never required** anywhere in the
candidate flow (see Module B validation rules). Counsel should still review:

- **No protected-characteristic ranking.** There is no scoring, ranking, or
  filtering by gender, religion, ethnicity, disability, or any other
  protected characteristic. If you add screening automation or AI features
  later, counsel must review for direct and indirect discrimination —
  including proxies (e.g. name, photo, address, university).
- **Human review of consequential decisions.** Stage transitions, rejections,
  and offers are human actions with required notes on moderation decisions
  and a full `application_status_history` + `audit_logs` trail. Keep it that
  way: do not auto-reject or auto-advance candidates without human review
  unless counsel has approved the criteria.
- **Explainable criteria.** The employer rating rubric
  (`application_notes`, kind `'rubric'`, 5 criteria) is structured and
  internal. Counsel: confirm the criteria are job-related and that internal
  notes practices don't create liability.
- **Job-post review:** counsel should review posting guidelines (non-
  discriminatory language in titles/descriptions, e.g. avoiding gendered or
  age-coded requirements) — consider publishing them to employers and
  enforcing via the `pending_review` moderation queue (`job_moderation_required`).

## 4. Workplace-harassment policy hooks

Pakistan's workplace-harassment framework (counsel: confirm current
provincial/federal coverage) requires internal processes that software alone
cannot provide. Platform hooks available:

- **In-app messaging** (`candidate_messages`) is the candidate-visible
  communication channel — all recruiter↔candidate contact is logged and
  auditable, which supports harassment-prevention policies better than
  off-platform contact. Consider policy language requiring its use.
- **Audit trail** (`audit_logs`) records who did what to whom and when.
- Counsel: advise on (a) whether candidate phone/email visibility rules
  (recruiter+ sees phone; candidate emails never shown in the employer
  portal) are sufficient, (b) reporting/escalation workflows the platform
  should add, and (c) display of the employer's harassment policy on job
  posts.

## 5. Internship / apprenticeship rules

Internships and apprenticeships may fall under specific provincial/federal
rules (stipends, duration, training obligations — counsel to confirm). The
platform has no special internship workflow today:

- If you list internships, counsel should advise whether they need distinct
  posting terms (stipend disclosure, duration caps, no-fee rules).
- The `employment_type` on jobs is free-text-validated — consider adding a
  dedicated type with counsel-approved required fields rather than reusing
  full-time postings.

## Before launch — counsel sign-off list

- [ ] Privacy notice copy (`/privacy`) reviewed and approved.
- [ ] Consent wording (apply flow, searchability opt-in) approved.
- [ ] Retention periods (24-month applications, 12-month contact messages,
      30-day deletion) confirmed lawful; business-records carve-out approved.
- [ ] Minimum-wage / jurisdiction configuration confirmed; no hardcoded values.
- [ ] Fair-hiring review: no protected-characteristic processing, human
      review of consequential decisions, explainable criteria.
- [ ] Harassment-prevention hooks and employer policy requirements defined.
- [ ] Internship/apprenticeship posting rules defined (if applicable).
- [ ] Sub-processor list (Supabase, Vercel, Resend if configured) disclosed.
- [ ] Terms of service (`/terms`) reviewed and approved.

**Re-review trigger:** any new feature that collects new personal data,
automates a hiring decision, or changes retention must go back to counsel
before shipping.
