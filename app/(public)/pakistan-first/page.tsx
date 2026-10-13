import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Pakistan-First Commitments",
  description:
    "TalentBridge's explicit commitments to Pakistani employers and job seekers: no penalties for internet disruptions, no geo-discrimination, Urdu support, and PKR transparency.",
};

const COMMITMENTS = [
  {
    title: "Never penalize for internet disruptions",
    body: "When Pakistan faces internet throttling or shutdowns, we will never mark your account 'unavailable', pause your jobs, or penalize your response rate. Other platforms have done this — we explicitly won't. If a disruption is declared, our system automatically freezes all inactivity penalties.",
    tag: "Policy",
  },
  {
    title: "No geo-discrimination by design",
    body: "We do not offer 'US-only' or location-exclusion filters. Pakistani candidates are never filtered out by geography. Location is shown as information, not used as a ranking signal against you.",
    tag: "Design",
  },
  {
    title: "PKR salary transparency",
    body: "Salaries are shown in Pakistani Rupees. We nudge employers to disclose ranges and badge jobs that don't. No bait-and-switch, no hidden compensation.",
    tag: "Feature",
  },
  {
    title: "Urdu support (coming)",
    body: "We're building Urdu language support with right-to-left layout. None of the global platforms serve Urdu speakers — we will.",
    tag: "Roadmap",
  },
  {
    title: "Asia/Karachi first",
    body: "All times, deadlines, and scheduling default to Pakistan Standard Time. No mental timezone math required.",
    tag: "Feature",
  },
  {
    title: "Low-bandwidth friendly",
    body: "Our pages are server-rendered and lightweight — they work on 3G and throttled connections. No heavy JavaScript bundles standing between you and a job application.",
    tag: "Design",
  },
];

export default function PakistanFirstPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center">
        <Badge tone="success">Our commitments</Badge>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">
          Built for Pakistan, not adapted to it.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Global platforms treat Pakistan as an edge case — penalizing users for
          infrastructure failures, enabling geographic discrimination, and ignoring
          local needs. These are our explicit, published commitments to do better.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {COMMITMENTS.map((c) => (
          <Card key={c.title}>
            <CardHeader>
              <CardTitle className="flex items-start justify-between gap-2 text-lg">
                {c.title}
                <Badge tone={c.tag === "Policy" ? "info" : c.tag === "Roadmap" ? "warning" : "success"}>
                  {c.tag}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-600">{c.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 rounded-lg border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
        <h2 className="text-xl font-bold text-emerald-900">
          The disruption pledge
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-emerald-800">
          If Pakistan experiences a government-ordered internet shutdown or severe
          throttling, TalentBridge will: (1) freeze all inactivity-based penalties,
          (2) extend all application deadlines by the disruption duration plus 7 days,
          (3) never mark accounts &ldquo;unavailable&rdquo; due to connectivity, and
          (4) publish a transparency notice. This is a public commitment.
        </p>
        <Link
          href="/jobs"
          className="mt-4 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Browse jobs
        </Link>
      </div>
    </main>
  );
}
