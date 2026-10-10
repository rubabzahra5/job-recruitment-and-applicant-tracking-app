import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms governing your use of the Job Recruitment And Applicant Tracking System platform.",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-xl font-bold text-slate-900">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 leading-relaxed text-slate-700">{children}</p>;
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Terms of Use</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: 10 October 2026</p>

      <P>
        These terms govern your use of Job Recruitment And Applicant Tracking System, a job recruitment and
        applicant tracking platform for Pakistan. By creating an account or
        using the platform, you agree to these terms.
      </P>

      <H2>1. The service</H2>
      <P>
        Job Recruitment And Applicant Tracking System provides (a) a public job board where candidates can
        search and apply for vacancies, and (b) recruitment tools for
        employers, including vacancy publishing, application tracking,
        interview scheduling, and offer management. We may add, change, or
        discontinue features with reasonable notice.
      </P>

      <H2>2. Accounts</H2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        <li>You must provide accurate information when registering and keep your account credentials confidential.</li>
        <li>You are responsible for activity under your account. Tell us immediately if you suspect unauthorized access.</li>
        <li>One person may not operate multiple candidate accounts to misrepresent themselves; one organization should operate a single employer account.</li>
        <li>We may suspend or close accounts that violate these terms, submit fraudulent information, or abuse the platform.</li>
      </ul>

      <H2>3. Rules for candidates</H2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        <li>Apply only for roles you genuinely intend to pursue, with truthful information about your experience and qualifications.</li>
        <li>Do not upload documents containing malware, and do not include other people&apos;s personal data in your applications.</li>
        <li>Do not scrape, copy, or resell job listings or employer data from the platform.</li>
      </ul>

      <H2>4. Rules for employers</H2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        <li>Post only genuine vacancies for real positions at your organization, with accurate descriptions, locations, and salary information where disclosed.</li>
        <li>Use candidate data solely for recruitment purposes. Do not share, sell, or reuse applicant data for any other purpose.</li>
        <li>Treat applicants fairly and comply with all applicable Pakistani employment and data-protection laws, including non-discrimination requirements.</li>
        <li>Vacancies are reviewed before publication; we may reject or remove postings that are misleading, discriminatory, or unlawful.</li>
      </ul>

      <H2>5. Content and intellectual property</H2>
      <P>
        You retain ownership of content you submit (profiles, CVs, job
        postings). By submitting it, you grant us the license needed to
        operate the platform — for example, to display your vacancy publicly
        or share your application with the employer you applied to. The
        Job Recruitment And Applicant Tracking System name, logo, and platform software remain our property.
      </P>

      <H2>6. Job listings are not offers</H2>
      <P>
        A vacancy posting is an invitation to apply, not a job offer or a
        guarantee of employment. Hiring decisions rest solely with the
        employer. We verify employers and remove expired postings, but we do
        not guarantee the accuracy of every listing — always confirm details
        with the employer during the hiring process.
      </P>

      <H2>7. Fees</H2>
      <P>
        Candidate accounts are free. Employer onboarding starts free; if paid
        plans or fees are introduced, they will be disclosed clearly before
        you incur any charge, and you may cancel as described at that time.
      </P>

      <H2>8. Privacy</H2>
      <P>
        How we collect, use, retain, and delete personal data is described in
        our{" "}
        <Link href="/privacy" className="font-semibold text-brand-700 hover:underline">
          Privacy Policy
        </Link>
        , which forms part of these terms.
      </P>

      <H2>9. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, Job Recruitment And Applicant Tracking System is provided
        “as is” without warranties. We are not liable for hiring decisions
        made by employers, the accuracy of user-submitted content, or indirect
        losses arising from your use of the platform. Nothing in these terms
        limits liability that cannot be limited under Pakistani law.
      </P>

      <H2>10. Changes</H2>
      <P>
        We may update these terms; material changes will be announced to
        registered users at least 14 days in advance. Continued use after the
        changes take effect constitutes acceptance.
      </P>

      <H2>11. Governing law</H2>
      <P>
        These terms are governed by the laws of Pakistan. Disputes will first
        be addressed through good-faith discussion; failing that, through the
        courts of Pakistan.
      </P>

      <H2>12. Contact</H2>
      <P>
        Questions about these terms?{" "}
        <Link href="/contact" className="font-semibold text-brand-700 hover:underline">
          Contact us
        </Link>
        .
      </P>
    </main>
  );
}
