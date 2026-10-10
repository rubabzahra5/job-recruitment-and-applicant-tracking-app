import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about using HirePakistan as a job seeker or employer.",
};

const SEEKER_FAQS = [
  {
    q: "Is HirePakistan free for job seekers?",
    a: "Yes. Searching jobs, creating a candidate account, saving vacancies, setting up job alerts, and applying are all free. We never charge candidates.",
  },
  {
    q: "How do I apply for a job?",
    a: "Open the vacancy, review the details and any application questions the employer has listed, then choose “Log in to apply”. You'll need a free candidate account. After signing in, your candidate dashboard guides you through the application.",
  },
  {
    q: "Why can't I see a job I saw yesterday?",
    a: "Only live vacancies appear in search: published postings whose application deadline hasn't passed, from employers with active accounts. Once a deadline passes or an employer closes a role, it is removed automatically.",
  },
  {
    q: "What does “Fresh graduates welcome” mean?",
    a: "The employer has explicitly marked the role as suitable for candidates with little or no work experience. Use the “Fresh graduates only” filter to see all such roles.",
  },
  {
    q: "How do job alerts work?",
    a: "Create a free account and set up alerts from your candidate dashboard with the keywords, cities, and categories you care about. You'll be notified when matching vacancies go live.",
  },
  {
    q: "Who can see my profile and CV?",
    a: "Your profile is private by default. Employers only see your details when you apply to their vacancy, or if you explicitly make your profile searchable. You can request deletion of your data at any time — see our Privacy Policy.",
  },
];

const EMPLOYER_FAQS = [
  {
    q: "How do I post a job?",
    a: "Register an employer account, complete your organization profile, and create a vacancy from your employer dashboard. Vacancies go through review before they appear publicly.",
  },
  {
    q: "What does employer verification involve?",
    a: "We confirm your organization is a legitimate, operating entity in Pakistan before marking it verified. Verified employers get a badge on their jobs and company profile.",
  },
  {
    q: "Can I manage applications on HirePakistan?",
    a: "Yes — that's the applicant tracking system. Applications move through a structured pipeline (screening, shortlist, interviews, offer), with interview scheduling, feedback, and offer management built in.",
  },
  {
    q: "Is there a cost to post jobs?",
    a: "Getting started is free. If paid plans are introduced, they'll be disclosed clearly before you commit to anything — core job posting will always have a free path.",
  },
];

function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mt-4 space-y-3">
      {items.map((f) => (
        <Card key={f.q} className="p-5">
          <h3 className="font-semibold text-slate-900">{f.q}</h3>
          <p className="mt-2 text-slate-600 leading-relaxed">{f.a}</p>
        </Card>
      ))}
    </div>
  );
}

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
        Frequently asked questions
      </h1>

      <h2 className="mt-10 text-xl font-bold text-slate-900">For job seekers</h2>
      <FaqList items={SEEKER_FAQS} />

      <h2 className="mt-10 text-xl font-bold text-slate-900">For employers</h2>
      <FaqList items={EMPLOYER_FAQS} />

      <p className="mt-10 text-slate-600">
        Still stuck?{" "}
        <Link href="/contact" className="font-semibold text-brand-700 hover:underline">
          Send us a message
        </Link>{" "}
        — we reply to every enquiry.
      </p>
    </main>
  );
}
