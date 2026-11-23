DRAFT - REVIEW BY QUALIFIED lawyer

# TalentBridge Privacy Policy (Draft)

**Status:** Draft for review by a qualified lawyer. Not published as final.
**Public version:** `app/(public)/privacy/page.tsx` (`/privacy`) renders the
same policy in web format and must be kept in step with this document.
**Last updated (draft):** 24 November 2026

TalentBridge ("we", "us") operates a job recruitment and applicant tracking
platform for Pakistan. This policy describes what personal data we collect,
why we collect it, who can see it, how long we keep it, and the rights you
have over it. It applies to candidates, employer staff, and visitors to our
public website.

## 1. Data we collect

**Account data.** When you register we collect your name, email address,
password (stored only as a salted hash by our authentication provider — we
never see or store plain-text passwords), and optionally your phone number.

**Candidate profile data.** If you build a candidate profile, we store what
you provide: work experience, education, skills, certifications, documents
such as your CV, and your job preferences. Your profile is **private by
default** (see §4).

**Application data.** When you apply for a job we store your application,
your answers to employer screening questions, attached documents, a consent
record for that application, and the history of your application's progress
through the hiring pipeline (including timestamps used by the response rule
in §5).

**Employer data.** Employer staff provide organisation details (name,
industry, website, contact details), vacancy postings, screening questions,
interview schedules, feedback, and hiring decisions.

**Community data.** If you use the community feed, we store your posts,
comments, likes, shares/reposts, and the people and organisations you
follow.

**Scam reports.** If you report a suspected scam job, we store what you
submit: your name and email (if you provide them), the organisation name,
the job link, the type of scam, your description, and any evidence links.
We also store a one-way hash of the reporter's IP address (never the raw
address) to prevent abuse of the reporting form.

**Contact enquiries.** Messages sent through our contact form (name,
email, subject, message) are stored so we can respond.

**Technical data.** Our hosting provider logs standard technical
information (IP address, browser type, pages visited) for security and
reliability. We do not sell this data and we do not use third-party
advertising trackers (see §7).

## 2. How we use your data

We use personal data only to operate the platform:

- Creating and securing your account, and signing you in.
- Showing your applications to the employers you applied to, so they can
  evaluate and contact you.
- Sending you service messages: application status changes, interview
  invitations, job alerts you asked for, and security notices.
- Displaying public job vacancies and verified employer profiles to
  visitors.
- Operating the community feed for signed-in users.
- Running the employer response rule (§5) and publishing organisation
  response rates.
- Investigating scam reports and other abuse, preventing fraud, and
  keeping audit records of administrative actions.

We do **not** sell personal data, and we do not share it with advertisers
or data brokers.

## 3. Who can see your data

**Public.** Job vacancies, verified employer profiles, categories, and
locations are public by design. A candidate's public profile page is
public **only if the candidate switches it on** (see §4).

**Employers.** An employer sees your candidate data only if you apply to
one of their vacancies, or if you explicitly opt into a public/searchable
profile.

**Other signed-in users.** Community feed posts are visible to signed-in
users, attributed to the author (or to the organisation the author posted
as).

**Platform administrators.** A small number of authorised administrators
can access data to operate the platform, investigate abuse (including scam
reports), and respond to your requests. Every administrative action is
logged.

**Service providers.** We use infrastructure providers who process data
only on our instructions: Supabase (database, authentication, file
storage), Vercel (website hosting), and Resend (email delivery, when
configured). The TalentBridge Assistant's optional AI fallback sends only
the text of an off-topic question to the AI provider — never account data.

## 4. Public profiles and consent

Candidate public profiles are **opt-in**. The `profile_public` setting
defaults to **off**, and no candidate has a public profile page until they
deliberately switch it on in their profile settings.

- Switching it on is your consent to publish the profile page
  (`/people/[your-id]`) with the details you chose to include.
- You can switch it off at any time; the public page then stops being
  visible.
- Separately, you may opt into being searchable by employers
  (`is_searchable`, also off by default). Applying for a job always shares
  your application with that employer, public profile or not.

## 5. The response rule and response rates

To protect candidates from "ghost jobs", employers are expected to give a
first response to each application within 7 business days (Monday–Friday,
excluding Pakistan public holidays, Asia/Karachi). The platform derives
each application's response status from its timestamps and stage history,
shows it to the candidate, and publishes each organisation's response
rate. Employers can appeal a "No response" mark (see the appeal process
document). This processing uses application data only; it does not involve
selling or sharing candidate data.

## 6. CV retention and deletion

- You can delete any document you uploaded (including your CV) at any time
  from your candidate documents area; deleted files are removed from
  storage.
- You can request deletion of your account and personal data from your
  candidate privacy page (`/candidate/privacy`) or via the contact page.
  Deletion requests are reviewed (to prevent accidental or malicious
  deletion) and completed **within 30 days**.
- Retention limits (platform policy choices):
  - **Active accounts:** data is kept while the account is active.
  - **Applications:** application records are kept for up to **24 months**
    after the hiring process ends, so candidates can track their history
    and employers can meet record-keeping needs; you may ask for earlier
    deletion.
  - **Contact messages:** kept for up to **12 months** after resolution.
  - **Scam reports:** kept while the report is investigated and for up to
    **24 months** afterwards, as evidence for repeat-offender decisions.
  - **Audit logs:** kept for up to **36 months** for security and
    accountability; they contain minimal personal data.
  - **Deleted accounts:** profile, CV, and personal details are removed
    within 30 days of an approved deletion request, except limited records
    we must retain for legal or security reasons.
- [VERIFY] Whether any Pakistan law or regulation imposes a **minimum**
  retention duty on employment/application records that would override a
  deletion request, and for how long. See `docs/open-questions.md`.

## 7. Cookies

TalentBridge uses **essential cookies only**:

- Authentication/session cookies set by our auth provider so you can sign
  in and stay signed in securely.
- Short-lived security cookies used to protect forms and sessions.

We do **not** use advertising cookies, cross-site trackers, or third-party
analytics cookies. If that ever changes, this policy and the public page
will be updated first and, where required, consent will be requested.
[VERIFY] Whether any consent banner is legally required for essential-only
cookies in Pakistan. See `docs/open-questions.md`.

## 8. Data breach response plan

If we become aware of a personal-data breach, we will:

1. **Detect & record** — log the discovery, what is known, and who is
   handling the response.
2. **Contain** — revoke compromised credentials/keys, close the access
   path, and preserve evidence for investigation.
3. **Assess** — determine what data was affected, whose data it was, and
   the likely risk to those people.
4. **Notify** — inform affected users without undue delay, in plain
   language: what happened, what data was involved, what we have done, and
   what they should do (for example, change their password). [VERIFY]
   Whether, and within what timeframe, a breach must also be reported to a
   Pakistani authority, and which authority that is — Pakistan's data
   protection framework must be confirmed by counsel. See
   `docs/open-questions.md`.
5. **Review** — after the incident, review causes and controls, fix gaps,
   and record lessons learned.

## 9. Your rights

You may at any time:

- **Access** a copy of the personal data we hold about you (an export is
  available from your candidate privacy page; other users can request one
  via the contact page).
- **Correct** inaccurate data in your profile and account settings.
- **Delete** your documents at any time, and request deletion of your
  account and personal data, subject to the retention limits in §6.
- **Withdraw consent** — for example, switch off a public profile, turn
  off employer searchability, or unsubscribe from job alerts.
- **Object to or restrict** certain processing, such as marketing
  messages.

To exercise these rights, use your account/privacy settings or contact us
via the contact page (`/contact`). We respond to privacy requests within
30 days.

## 10. Where your data is stored

Data is stored with our cloud infrastructure providers and may be
processed in data centres outside Pakistan. Wherever it lives, it is
protected by the same access controls described in this policy, and
database access is restricted by row-level security so users only see data
they are entitled to.

## 11. Security

We protect data with encrypted connections (HTTPS), salted password
hashing, row-level database access controls, server-controlled trust
fields (verification and suspension status cannot be changed by users
directly), and owner-only access to uploaded CVs. No system is perfectly
secure; §8 describes what we do if something goes wrong.

## 12. Children

TalentBridge is intended for people aged 16 and over who are seeking
employment. We do not knowingly collect data from children under 16.
[VERIFY] The correct minimum age under applicable Pakistan law.

## 13. Changes to this policy

We will update this document and the public page when our practices
change and note the new "last updated" date. Material changes will also be
announced to registered users by email or in-app notification.

## 14. Contact

Questions about privacy, or a privacy request: use the contact page
(`/contact`) and mention "Privacy" in the subject line so it is routed
correctly.
