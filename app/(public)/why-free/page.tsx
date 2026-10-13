import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Why TalentBridge Is Free",
  description:
    "TalentBridge charges zero fees to employers and job seekers. See how we compare to LinkedIn, Indeed, Upwork, and Fiverr.",
};

const COMPARISON = [
  {
    platform: "TalentBridge",
    highlight: true,
    fees: [
      "Rs. 0 — posting jobs",
      "Rs. 0 — applications",
      "Rs. 0 — commissions",
      "Rs. 0 — bidding",
    ],
    note: "Free tier. No paid dependencies. No credit card required.",
  },
  {
    platform: "LinkedIn",
    highlight: false,
    fees: [
      "Premium: ~$40–70/month",
      "Recruiter: very expensive",
      "Pay for visibility",
    ],
    note: "Charges seekers for access; investigated for profiting from misleading postings.",
  },
  {
    platform: "Indeed",
    highlight: false,
    fees: [
      "~$25–100 per applicant",
      "Charged even for unqualified applicants",
      "Pay to maintain visibility",
    ],
    note: "Pay-per-application model penalizes employers for volume they didn't ask for.",
  },
  {
    platform: "Upwork",
    highlight: false,
    fees: [
      "0–15% service fee",
      "Pay-to-bid: ~$0.15 per Connect",
      "$1k–50k off-platform fee",
    ],
    note: "Freelancers pay to compete for work they may not win.",
  },
  {
    platform: "Fiverr",
    highlight: false,
    fees: [
      "20% seller commission",
      "5.5% + $3.50 buyer fee",
      '"$5" gig costs ~$8.78',
    ],
    note: "Among the highest take rates in the industry, on both sides.",
  },
];

export default function WhyFreePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="text-center">
        <Badge tone="success" >Our promise</Badge>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">
          Free means free.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          TalentBridge runs on free-tier infrastructure and charges nothing to employers
          or job seekers. No commissions, no pay-to-bid, no pay-per-application.
          Here&apos;s the honest comparison.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {COMPARISON.map((c) => (
          <Card
            key={c.platform}
            className={c.highlight ? "border-2 border-emerald-500 shadow-lg" : ""}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {c.platform}
                {c.highlight && <Badge tone="success">This is us</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {c.fees.map((f) => (
                  <li
                    key={f}
                    className={`text-sm ${c.highlight ? "font-semibold text-emerald-700" : "text-slate-600"}`}
                  >
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {c.note}
              </p>
            </CardContent>
          </Card>
        ))}
        <Card className="flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
          <p className="text-lg font-semibold text-slate-800">
            The difference is structural.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            The giants monetize volume — more listings, more bids, more fees.
            We monetize nothing. Our incentive is successful hires, not transactions.
          </p>
          <Link
            href="/jobs"
            className="mt-4 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Browse jobs — free
          </Link>
        </Card>
      </div>

      <div className="mt-12 rounded-lg bg-slate-50 p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">Our commitments</h2>
        <ul className="mx-auto mt-4 max-w-2xl space-y-2 text-left text-sm text-slate-700">
          <li>✓ No fees will ever be charged for posting, applying, or hiring.</li>
          <li>✓ No &ldquo;premium&rdquo; tier that gates visibility or features.</li>
          <li>✓ No pay-to-bid, no commissions, no per-applicant charges.</li>
          <li>✓ If we ever need to cover costs, it will be through optional employer services — never by taxing job seekers.</li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Fee figures for other platforms are reported claims from 2024–2026 sources
          (US-centric). See our research page for sources.
        </p>
      </div>
    </main>
  );
}
