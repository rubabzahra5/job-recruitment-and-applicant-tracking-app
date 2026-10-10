"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: "/candidate", label: "Dashboard", exact: true },
  { href: "/candidate/profile", label: "Profile" },
  { href: "/candidate/resume", label: "Resume" },
  { href: "/candidate/applications", label: "Applications" },
  { href: "/candidate/saved-jobs", label: "Saved Jobs" },
  { href: "/candidate/job-alerts", label: "Job Alerts" },
  { href: "/candidate/notifications", label: "Notifications" },
  { href: "/candidate/privacy", label: "Privacy" },
  { href: "/candidate/settings", label: "Settings" },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Portal sidebar / top navigation with active-link highlighting. */
export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Candidate portal" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              active
                ? "bg-brand-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <div className="my-2 border-t border-slate-200" aria-hidden="true" />
      <Link
        href="/jobs"
        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        Browse Jobs
      </Link>
    </nav>
  );
}
