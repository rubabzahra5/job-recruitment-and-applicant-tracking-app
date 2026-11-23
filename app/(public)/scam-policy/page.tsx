import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Scam-Job Policy",
  description:
    "TalentBridge's anti-scam rules: employers must never ask candidates for money, jobs must be real, and what happens when the rules are broken.",
};

function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 text-xl font-bold text-slate-900">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 leading-relaxed text-slate-700">{children}</p>;
}

const RED_FLAGS = [
  "Any request for money — fees, deposits, “training charges”, equipment purchases or gift cards, at any stage.",
  "Requests for bank details, card PINs or OTP codes before you have a written offer from a verified employer.",
  "Pay that sounds too good for the work described, with vague duties.",
  "Pressure to move off the platform quickly to personal WhatsApp or Telegram accounts, especially before any interview.",
  "Interviews only by text chat — no real person, no office, no verifiable company presence.",
  "A company name that almost matches a famous company, or a big employer writing from a free mailbox.",
  "Being asked to receive or forward money or parcels — this can involve you in fraud.",
  "Instant “selection” with no interview or assessment at all.",
];

const LADDER = [
  {
    step: "1 · Warning",
    trigger: "First, minor breach — for example misleading job details.",
  },
  {
    step: "2 · Job removed",
    trigger: "Misleading or non-existent vacancy, or a repeat minor breach.",
  },
  {
    step: "3 · Organisation suspended",
    trigger: "Money-asking, impersonation, or repeated breaches. The organisation cannot post or respond until reviewed.",
  },
  {
    step: "4 · Account terminated",
    trigger: "Confirmed scam or fraud, or a breach after suspension. The organisation and responsible user accounts are closed.",
  },
];

export default function ScamPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="text-center">
        <Badge tone="warning">Trust &amp; safety</Badge>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
          Our scam-job policy
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          TalentBridge is free for candidates — always. Any “job” that asks a
          candidate for money is a scam. These are the rules, what happens
          when they are broken, and how to protect yourself.
        </p>
        <Link
          href="/report-scam"
          className="mt-5 inline-block rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Report a scam job
        </Link>
      </div>

      <H2>The rules for employers</H2>
      <P>
        <strong>1. Never ask candidates for money.</strong> No application,
        processing or “registration” fees; no security or refundable
        deposits; no payment for training, materials or “starter kits” as a
        condition of being hired; no gift cards, mobile top-ups or
        cryptocurrency; and no bank details, card numbers, PINs or one-time
        passcodes (OTPs) during application or interview. There are no
        exceptions — TalentBridge charges candidates nothing, and legitimate
        employers here do not either.
      </P>
      <P>
        <strong>2. Jobs must be real.</strong> Every posting must be a
        genuine, current vacancy at the named organisation, with a truthful
        title, description, location and salary information in PKR. Posting
        a vacancy that does not exist, or harvesting CVs for other purposes,
        is prohibited.
      </P>
      <P>
        <strong>3. Post as who you are.</strong> Postings must come from the
        organisation&apos;s own verified account. Impersonating another
        company, a government body, or TalentBridge itself is prohibited.
      </P>
      <P>
        <strong>4. No misleading pay or conditions.</strong> Salary ranges,
        job type and workplace (on-site/remote) must match the real offer.
      </P>

      <H2>What happens when the rules are broken</H2>
      <P>
        Breaches are handled in proportion to severity and history.
        Money-asking and impersonation are severe and may skip earlier
        steps. Every decision is recorded, and an organisation can ask for
        a review via the{" "}
        <Link href="/contact" className="font-semibold text-brand-700 hover:underline">
          contact page
        </Link>
        .
      </P>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {LADDER.map((l) => (
          <Card key={l.step}>
            <CardHeader>
              <CardTitle className="text-base">{l.step}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-600">{l.trigger}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <H2>How reports are handled</H2>
      <P>
        Anyone can report a suspected scam via the{" "}
        <Link href="/report-scam" className="font-semibold text-brand-700 hover:underline">
          report-a-scam page
        </Link>{" "}
        — no account needed. We aim to acknowledge reports within{" "}
        <strong>2 business days</strong> and complete an initial review
        within <strong>5 business days</strong> (Monday–Friday, excluding
        Pakistan public holidays). Urgent reports — money already sent, or
        impersonation of a real company — are prioritised. If you gave an
        email address, we will tell you the outcome in general terms.
      </P>

      <H2>Red flags — protect yourself</H2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        {RED_FLAGS.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <P>
        If you have already sent money: contact your bank or payment
        provider immediately, keep all messages and receipts, and still{" "}
        <Link href="/report-scam" className="font-semibold text-brand-700 hover:underline">
          report it to us
        </Link>{" "}
        — your report protects the next candidate.
      </P>

      <H2 id="no-response-appeals">Employers: appealing a “No response” mark</H2>
      <P>
        Our response rule expects a first response to every application
        within 7 business days. If the deadline passes with no response
        recorded on the platform, the application shows as “No response” to
        the candidate and counts toward your public response rate. The mark
        is about what happened <em>on the platform</em> — and sometimes it
        is wrong. You can appeal if, for example:
      </P>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
        <li>you responded to the candidate outside the platform (email, phone, interview) but did not update the stage here;</li>
        <li>the candidate withdrew before the deadline;</li>
        <li>the role was filled and applicants were informed, but the applications were not closed here;</li>
        <li>a platform error or a declared internet-disruption period prevented a timely response;</li>
        <li>you believe the deadline was calculated over a Pakistan public holiday our calendar missed.</li>
      </ul>
      <P>
        <strong>How to appeal:</strong> use the{" "}
        <Link href="/contact" className="font-semibold text-brand-700 hover:underline">
          contact page
        </Link>{" "}
        with the subject line <strong>“No response appeal — &lt;your organisation name&gt;”</strong>,
        from the email address on your employer account. Include the job
        title, the candidate&apos;s name or application date, the reason,
        and any evidence (for example the email you sent the candidate). We
        acknowledge appeals within 2 business days and decide within 5
        business days. Outcomes: the mark is removed, your response rate is
        adjusted, or the mark is upheld with an explanation. Fabricated
        evidence is itself a serious breach under the ladder above.
      </P>
    </main>
  );
}
