import Link from "next/link";
import { MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";

export interface CompanyCardData {
  slug: string;
  name: string;
  logoUrl?: string | null;
  industry?: string | null;
  city?: string | null;
  openRoles: number;
  verified: boolean;
  href: string;
}

/** Company card: logo tile, name + verified, industry · city, open-role count. */
export function CompanyCard({ company }: { company: CompanyCardData }) {
  return (
    <Link
      href={company.href}
      className="card-lift group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:border-brand-300 hover:shadow-[0_8px_30px_-8px_rgba(15,98,196,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
    >
      {company.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={company.logoUrl}
          alt={`${company.name} logo`}
          className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-contain"
          loading="lazy"
        />
      ) : (
        <Avatar name={company.name} size="lg" className="rounded-xl" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-bold text-slate-900 group-hover:text-brand-700">
            {company.name}
          </span>
          {company.verified && (
            <StatusPill tone="emerald" className="shrink-0">
              Verified
            </StatusPill>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          {company.industry && <span className="truncate">{company.industry}</span>}
          {company.city && (
            <span className="inline-flex shrink-0 items-center gap-0.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {company.city}
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
          {company.openRoles}
        </p>
        <p className="text-xs text-slate-500">open role{company.openRoles === 1 ? "" : "s"}</p>
      </div>
    </Link>
  );
}
