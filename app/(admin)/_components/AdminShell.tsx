"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

const NAV: { href: string; label: string }[] = [
  { href: "/control-center", label: "Overview" },
  { href: "/control-center/approvals", label: "Approvals" },
  { href: "/control-center/organizations", label: "Organizations" },
  { href: "/control-center/users", label: "Users" },
  { href: "/control-center/roles", label: "Roles" },
  { href: "/control-center/jobs", label: "Jobs" },
  { href: "/control-center/applications", label: "Applications" },
  { href: "/control-center/candidates", label: "Candidates" },
  { href: "/control-center/interviews", label: "Interviews" },
  { href: "/control-center/offers", label: "Offers" },
  { href: "/control-center/categories", label: "Categories" },
  { href: "/control-center/locations", label: "Locations" },
  { href: "/control-center/reports", label: "Reports" },
  { href: "/control-center/audit-logs", label: "Audit Logs" },
  { href: "/control-center/notifications", label: "Notifications" },
  { href: "/control-center/settings", label: "Settings" },
  { href: "/control-center/security", label: "Security" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/control-center" && pathname.startsWith(`${href}/`));
}

function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const supabase = createClient();
          await supabase.auth.signOut();
        } finally {
          router.push("/login");
          router.refresh();
        }
      }}
      className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

/**
 * Admin chrome: dark sidebar (visually distinct from the public site).
 * Hidden on /control-center/login so the login checkpoint renders standalone.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/control-center/login") {
    return <div className="min-h-screen bg-slate-100">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-slate-950 text-slate-300 md:flex">
        <div className="border-b border-slate-800 px-5 py-4">
          <p className="text-base font-bold text-white">Job Recruitment And Applicant Tracking System</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-amber-400">
            Control Center
          </p>
        </div>
        <nav aria-label="Control center sections" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive(pathname, item.href)
                      ? "bg-slate-800 font-medium text-white"
                      : "hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-slate-800 px-3 py-3">
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile section nav */}
        <nav
          aria-label="Control center sections"
          className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-950 px-3 py-2 md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                isActive(pathname, item.href)
                  ? "bg-slate-700 font-medium text-white"
                  : "text-slate-300"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
