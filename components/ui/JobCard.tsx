"use client";

import Link from "next/link";
import { Bookmark, MapPin } from "lucide-react";
import * as React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatPKR } from "@/lib/format";

export interface JobCardData {
  id: string;
  title: string;
  companyName: string;
  companyLogoUrl?: string | null;
  verified: boolean;
  city?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType?: string | null;
  workplace?: string | null;
  tags?: string[];
  postedAgo: string;
  responseRate?: number | null;
  href: string;
  saved?: boolean;
  onToggleSave?: (id: string) => void;
}

function ResponseRing({ rate }: { rate: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const color = rate >= 70 ? "#047857" : rate >= 40 ? "#b45309" : "#be123c";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Employer responds to ${rate}% of applications`}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, Math.max(0, rate)) / 100)}
          transform="rotate(-90 11 11)"
        />
      </svg>
      <span className="text-xs font-medium text-slate-600 tabular-nums">{rate}%</span>
    </span>
  );
}

/**
 * Premium job card: logo tile → title + verified → location/salary →
 * 2–3 chips → posted time + response ring + bookmark. Hover lift + border glow.
 */
export function JobCard({ job }: { job: JobCardData }) {
  const [saved, setSaved] = React.useState(job.saved ?? false);
  const salary =
    job.salaryMin || job.salaryMax
      ? `${formatPKR(job.salaryMin ?? job.salaryMax ?? 0)}${job.salaryMax && job.salaryMin !== job.salaryMax ? ` – ${formatPKR(job.salaryMax)}` : ""}`
      : null;

  return (
    <article className="card-lift group relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:border-brand-300 hover:shadow-[0_8px_30px_-8px_rgba(15,98,196,0.25)]">
      <div className="flex items-start gap-3">
        {job.companyLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.companyLogoUrl}
            alt={`${job.companyName} logo`}
            className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-contain"
            loading="lazy"
          />
        ) : (
          <Avatar name={job.companyName} size="lg" className="rounded-xl" />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={job.href}
            className="block truncate text-base font-bold text-slate-900 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
          >
            {job.title}
          </Link>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
            <span className="truncate">{job.companyName}</span>
            {job.verified && (
              <StatusPill tone="emerald" className="shrink-0">
                Verified
              </StatusPill>
            )}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved jobs" : "Save this job"}
          onClick={() => {
            setSaved((s) => !s);
            job.onToggleSave?.(job.id);
          }}
          className="rounded-lg p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:scale-90"
        >
          <Bookmark className={`h-5 w-5 ${saved ? "fill-brand-600 text-brand-600" : ""}`} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {job.city && (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
            {job.city}
          </span>
        )}
        {salary && (
          <span className="font-bold text-slate-900 tabular-nums">{salary}</span>
        )}
      </div>

      {(job.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.tags!.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">{job.postedAgo}</span>
        {job.responseRate != null && <ResponseRing rate={job.responseRate} />}
      </div>
    </article>
  );
}
