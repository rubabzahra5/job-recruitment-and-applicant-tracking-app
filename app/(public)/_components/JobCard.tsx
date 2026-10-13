import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { formatDateOnlyKarachi, formatSalaryRange, timeAgo } from "@/lib/format";
import {
  EMPLOYMENT_TYPE_LABELS,
  WORKPLACE_LABELS,
  type PublicJob,
} from "../_lib/public-data";

/** Public job listing card — real DB data only, no hardcoded content. */
export function JobCard({
  job,
  responseBadge,
}: {
  job: PublicJob;
  /** Pre-computed "Responds to X% of applications" badge (ghost-job accountability). */
  responseBadge?: string | null;
}) {
  const locationLabel = job.workplace === "remote"
    ? "Remote"
    : job.location
      ? `${job.location.city}, ${job.location.province}`
      : "Pakistan";

  return (
    <article className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/jobs/${job.slug}`}
            className="text-lg font-semibold text-slate-900 group-hover:text-brand-700 group-hover:underline"
          >
            {job.title}
          </Link>
          <p className="mt-1 text-sm text-slate-600">
            {job.org ? (
              <Link href={`/companies/${job.org.slug}`} className="font-medium text-slate-700 hover:text-brand-700 hover:underline">
                {job.org.name}
              </Link>
            ) : (
              "Employer"
            )}
            {job.org?.verification_status === "verified" && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Verified
              </span>
            )}
            <span aria-hidden="true" className="mx-2 text-slate-300">·</span>
            <span>{locationLabel}</span>
          </p>
        </div>
        {job.org?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.org.logo_url}
            alt={`${job.org.name} logo`}
            className="h-11 w-11 shrink-0 rounded-md border border-slate-200 object-contain bg-white"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-900 text-lg font-bold text-white"
          >
            {(job.org?.name ?? job.title).charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="info">{EMPLOYMENT_TYPE_LABELS[job.employment_type] ?? job.employment_type}</Badge>
        <Badge tone="neutral">{WORKPLACE_LABELS[job.workplace] ?? job.workplace}</Badge>
        {job.is_fresh_graduate_ok && <Badge tone="success">Fresh graduates welcome</Badge>}
        {job.category && <Badge tone="neutral">{job.category.name}</Badge>}
        {responseBadge && (
          <Badge tone="success" title="Share of applications this employer actively reviewed in the last 90 days">
            {responseBadge}
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
        <span className="font-medium text-slate-800">
          {job.salary_disclosed
            ? formatSalaryRange(job.salary_min, job.salary_max, job.salary_period)
            : "Salary not disclosed"}
        </span>
        {job.deadline && (
          <span>
            Apply by <time dateTime={job.deadline}>{formatDateOnlyKarachi(job.deadline)}</time>
          </span>
        )}
        <span className="text-slate-400" title={formatDateOnlyKarachi(job.published_at ?? job.created_at)}>
          {timeAgo(job.published_at ?? job.created_at)}
        </span>
      </div>

      {job.skills.length > 0 && (
        <p className="mt-2 truncate text-xs text-slate-500">
          {job.skills.slice(0, 5).join(" · ")}
        </p>
      )}
    </article>
  );
}
