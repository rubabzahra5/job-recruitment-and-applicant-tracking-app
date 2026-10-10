"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/employer", label: "Dashboard", exact: true },
  { href: "/employer/jobs", label: "Jobs" },
  { href: "/employer/applications", label: "Applications" },
  { href: "/employer/interviews", label: "Interviews" },
  { href: "/employer/offers", label: "Offers" },
  { href: "/employer/reports", label: "Reports" },
  { href: "/employer/team", label: "Team" },
  { href: "/employer/departments", label: "Departments" },
  { href: "/employer/profile", label: "Organization" },
  { href: "/employer/settings", label: "Settings" },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Employer nav; preserves the ?org= param across navigation. */
export function EmployerNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const org = searchParams.get("org");
  const withOrg = (href: string) => (org ? `${href}?org=${encodeURIComponent(org)}` : href);

  return (
    <nav aria-label="Employer" className="flex flex-wrap items-center gap-1">
      {LINKS.map((l) => {
        const active = isActive(pathname, l.href, l.exact);
        return (
          <Link
            key={l.href}
            href={withOrg(l.href)}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
