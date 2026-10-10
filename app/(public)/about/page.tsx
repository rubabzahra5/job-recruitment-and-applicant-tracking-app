import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "About Us",
  description: "Job Recruitment And Applicant Tracking System is a job recruitment and applicant tracking platform built for Pakistan's workforce.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">About Job Recruitment And Applicant Tracking System</h1>

      <div className="prose-slate mt-6 space-y-5 text-slate-700 leading-relaxed">
        <p>
          Job Recruitment And Applicant Tracking System is a job recruitment and applicant tracking platform built
          for Pakistan. We connect job seekers with employers across the
          country — from Karachi&apos;s tech corridors to Lahore&apos;s
          factories, Islamabad&apos;s public sector, and the growing startup
          scenes in Peshawar, Quetta, and beyond.
        </p>
        <p>
          For candidates, Job Recruitment And Applicant Tracking System is a free job board: search live
          vacancies by keyword, city, category, salary, and workplace, save
          roles you like, and apply with a structured application that puts
          your best foot forward. Fresh graduates get a dedicated space —
          employers mark the roles they are genuinely open to entry-level
          candidates for.
        </p>
        <p>
          For employers, Job Recruitment And Applicant Tracking System is a complete applicant tracking system:
          publish vacancies, collect structured applications with screening
          questions, move candidates through a transparent hiring pipeline,
          schedule interviews, and make offers — all in one place, with an
          audit trail your HR team can trust.
        </p>
        <p>
          Every employer on the platform goes through verification, and only
          live, published vacancies from active accounts ever appear in search.
          Expired postings are removed automatically, so what you see is what
          you can apply for.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { title: "Verified employers", body: "Organizations are verified before their jobs go live." },
          { title: "Live vacancies only", body: "Expired or unpublished postings never appear in search." },
          { title: "Free for candidates", body: "Searching, saving, and applying costs nothing — ever." },
        ].map((c) => (
          <Card key={c.title} className="p-5">
            <p className="font-semibold text-slate-900">{c.title}</p>
            <p className="mt-1 text-sm text-slate-600">{c.body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/jobs"
          className="rounded-md bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
        >
          Browse jobs
        </Link>
        <Link
          href="/register?type=employer"
          className="rounded-md border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-900 hover:bg-slate-50"
        >
          Hire with us
        </Link>
        <Link
          href="/contact"
          className="rounded-md px-5 py-2.5 font-semibold text-brand-700 hover:underline"
        >
          Contact us →
        </Link>
      </div>
    </main>
  );
}
