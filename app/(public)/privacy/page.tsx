import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How TalentBridge collects, uses, retains, and deletes your personal data.",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-xl font-bold text-slate-900">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 leading-relaxed text-slate-700">{children}</p>;
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: 24 November 2026</p>

      <P>
        TalentBridge (“we”, “us”) operates a job recruitment and applicant
        tracking platform for Pakistan. This policy describes what personal
        data we collect, why we collect it, how long we keep it, and the
        rights you have over it. It applies to candidates, employer staff,
        and visitors to our public website.
      </P>

      <H2>1. Data we collect</H2>
      <P><strong>Account data.</strong> When you register we collect your name, email address, password (stored only as a salted hash by our authentication provider — we never see or store plain-text passwords), and optionally your phone number.</P>
      <P><strong>Candidate profile data.</strong> If you build a candidate profile, we store what you provide: work experience, education, skills, certifications, documents such as your CV, and your job preferences. Your profile is <strong>private by default</strong> (see §4).</P>
      <P><strong>Application data.</strong> When you apply for a job we store your application, your answers to employer screening questions, attached documents, a consent record for the application, and the history of your application&apos;s progress through the hiring pipeline.</P>
      <P><strong>Employer data.</strong> Employer staff provide organization details (name, industry, website, contact details), vacancy postings, screening questions, interview schedules, feedback, and hiring decisions.</P>
      <P><strong>Community data.</strong> If you use the community feed, we store your posts, comments, likes, shares, and the people and organisations you follow.</P>
      <P><strong>Scam reports.</strong> If you report a suspected scam job, we store what you submit (your name and email if you provide them, the organisation name, the job link, your description and any evidence links) and a one-way hash of your IP address — never the raw address — to prevent abuse of the form.</P>
      <P><strong>Contact enquiries.</strong> Messages sent through our contact form (name, email, subject, message) are stored so we can respond.</P>
      <P><strong>Technical data.</strong> Like most websites, our hosting provider logs standard technical information (IP address, browser type, pages visited) for security and reliability. We do not sell this data or use third-party advertising trackers (see §6).</P>

      <H2>2. How we use your data</H2>
      <P>We use personal data only to operate the platform:</P>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        <li>Creating and securing your account, and signing you in.</li>
        <li>Showing your applications to the employers you applied to, so they can evaluate and contact you.</li>
        <li>Sending you service messages: application status changes, interview invitations, job alerts you asked for, and security notices.</li>
        <li>Displaying public job vacancies and verified employer profiles to visitors.</li>
        <li>Operating the community feed for signed-in users.</li>
        <li>Running the employer response rule — employers are expected to respond to applications within 7 business days — and publishing organisation response rates.</li>
        <li>Investigating scam reports, preventing fraud and abuse, and keeping audit records of administrative actions.</li>
      </ul>
      <P>We do <strong>not</strong> sell personal data, and we do not share it with advertisers or data brokers.</P>

      <H2>3. Who can see your data</H2>
      <P><strong>Public.</strong> Job vacancies, verified employer profiles, categories, and locations are public by design. A candidate&apos;s public profile page is public only if the candidate switches it on (§4).</P>
      <P><strong>Employers.</strong> An employer sees your candidate data only if you apply to one of their vacancies, or if you explicitly opt into making your profile searchable by employers.</P>
      <P><strong>Other signed-in users.</strong> Community feed posts are visible to signed-in users, under your name or the organisation you posted as.</P>
      <P><strong>Platform administrators.</strong> A small number of authorized administrators can access data to operate the platform, investigate abuse (including scam reports), and respond to your requests. Every administrative action is logged.</P>
      <P><strong>Service providers.</strong> We use infrastructure providers (hosting, database, email delivery) who process data only on our instructions and under contract. The TalentBridge Assistant&apos;s optional AI fallback sends only the text of an off-topic question to the AI provider — never account data.</P>

      <H2>4. Public profiles and your consent</H2>
      <P>
        Candidate public profiles are <strong>opt-in and off by default</strong>.
        No candidate has a public profile page until they deliberately switch
        it on in their profile settings. Switching it on is your consent to
        publish that page with the details you chose to include; switch it
        off at any time and the page stops being visible. Separately, you may
        opt into being searchable by employers — also off by default.
        Applying for a job always shares your application with that employer,
        public profile or not.
      </P>

      <H2>5. Data retention and deleting your CV</H2>
      <P>
        You can delete any document you uploaded — including your CV — at any
        time from your candidate documents area. You can request deletion of
        your whole account from your candidate privacy page or via the{" "}
        <Link href="/contact" className="font-semibold text-brand-700 hover:underline">contact page</Link>;
        requests are reviewed and completed within 30 days.
      </P>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        <li><strong>Active accounts:</strong> we keep your data while your account is active and you use the platform.</li>
        <li><strong>Applications:</strong> application records are kept for up to 24 months after the hiring process ends, so employers can meet record-keeping needs and candidates can track their history. You may ask for earlier deletion (see §9).</li>
        <li><strong>Scam reports:</strong> kept while investigated and for up to 24 months afterwards, as evidence for repeat-offender decisions.</li>
        <li><strong>Contact messages:</strong> kept for up to 12 months after resolution.</li>
        <li><strong>Audit logs:</strong> kept for up to 36 months for security and accountability; they contain minimal personal data.</li>
        <li><strong>Deleted accounts:</strong> when you delete your account, your profile, CV, and personal details are removed within 30 days, except where we must retain limited records for legal or security reasons.</li>
      </ul>

      <H2>6. Cookies</H2>
      <P>
        TalentBridge uses <strong>essential cookies only</strong>: the
        sign-in/session cookies that keep you securely logged in, and
        short-lived security cookies that protect forms. We do not use
        advertising cookies, cross-site trackers, or third-party analytics
        cookies. If that ever changes, we will update this policy first.
      </P>

      <H2>7. If something goes wrong: data breaches</H2>
      <P>
        If we become aware of a breach affecting personal data, we will:
        record what happened, contain it (revoke compromised access and
        close the path), assess whose data was affected and the risk to
        them, notify affected users in plain language without undue delay —
        what happened, what data was involved, what we have done, and what
        they should do — and afterwards review and fix the gaps that allowed
        it.
      </P>

      <H2>8. Where your data is stored</H2>
      <P>
        Data is stored with our cloud infrastructure providers and may be
        processed in data centers outside Pakistan. Wherever it lives, it is
        protected by the same access controls described in this policy, and
        database access is restricted by row-level security so users only see
        data they are entitled to.
      </P>

      <H2>9. Your rights</H2>
      <P>You may at any time:</P>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        <li>Access a copy of the personal data we hold about you (candidates can export from their privacy page; anyone can request via the contact page).</li>
        <li>Correct inaccurate data in your profile and account settings.</li>
        <li>Withdraw consent — for example, turn off a public or searchable profile, or unsubscribe from job alerts.</li>
        <li>Request deletion of your account and personal data (“right to be forgotten”), subject to the retention limits in §5.</li>
        <li>Object to or restrict certain processing, such as marketing messages.</li>
      </ul>
      <P>
        To exercise these rights, use the account settings in your dashboard or{" "}
        <Link href="/contact" className="font-semibold text-brand-700 hover:underline">contact us</Link>.
        We respond to privacy requests within 30 days.
      </P>

      <H2>10. Security</H2>
      <P>
        We protect data with encrypted connections (HTTPS), salted password
        hashing, row-level database access controls, server-controlled trust
        fields (verification and suspension status cannot be changed by users
        directly), and owner-only access to uploaded CVs. No system is
        perfectly secure, so we also keep audit logs of administrative access
        and review them regularly. Section 7 describes what we do if a breach
        happens.
      </P>

      <H2>11. Children</H2>
      <P>
        TalentBridge is intended for people aged 16 and over who are seeking
        employment. We do not knowingly collect data from children under 16.
      </P>

      <H2>12. Changes to this policy</H2>
      <P>
        We will update this page when our practices change and note the new
        “last updated” date. Material changes will also be announced to
        registered users by email or in-app notification.
      </P>

      <H2>13. Contact</H2>
      <P>
        Questions about privacy?{" "}
        <Link href="/contact" className="font-semibold text-brand-700 hover:underline">
          Send us a message
        </Link>{" "}
        with “Privacy” in the subject line and we&apos;ll get back to you.
      </P>
    </main>
  );
}
