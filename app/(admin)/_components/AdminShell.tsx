"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";

/* ── Minimal SVG icons (stroke style, consistent) ── */
function iconWrap(path: React.ReactNode) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      {path}
    </svg>
  );
}
const IconGrid = () => iconWrap(<><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></>);
const IconCheck = () => iconWrap(<><path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" /></>);
const IconChart = () => iconWrap(<><path d="M4 16V9M10 16V4M16 16v-6" strokeLinecap="round" /></>);
const IconList = () => iconWrap(<><path d="M7 5h10M7 10h10M7 15h10" strokeLinecap="round" /><circle cx="4" cy="5" r="1" fill="currentColor" /><circle cx="4" cy="10" r="1" fill="currentColor" /><circle cx="4" cy="15" r="1" fill="currentColor" /></>);
const IconBell = () => iconWrap(<><path d="M10 3a5 5 0 015 5v3l2 3H3l2-3V8a5 5 0 015-5z" strokeLinejoin="round" /><path d="M8.5 16a1.5 1.5 0 003 0" strokeLinecap="round" /></>);
const IconBuilding = () => iconWrap(<><rect x="4" y="4" width="12" height="13" rx="1" /><path d="M7 7h2M11 7h2M7 10h2M11 10h2M7 13h2M11 13h2" strokeLinecap="round" /></>);
const IconUsers = () => iconWrap(<><circle cx="7" cy="7" r="2.5" /><path d="M2.5 16c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4" strokeLinecap="round" /><circle cx="13.5" cy="8" r="2" /><path d="M14 12.2c1.7.3 3 1.6 3.5 3.8" strokeLinecap="round" /></>);
const IconKey = () => iconWrap(<><circle cx="7" cy="10" r="3.5" /><path d="M10.5 10H17M14 10v3M17 10v2" strokeLinecap="round" /></>);
const IconBriefcase = () => iconWrap(<><rect x="3" y="7" width="14" height="9" rx="1.5" /><path d="M7 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 11h14" strokeLinecap="round" /></>);
const IconDoc = () => iconWrap(<><path d="M6 3h6l4 4v10H6z" strokeLinejoin="round" /><path d="M12 3v4h4M9 12h4M9 15h4" strokeLinecap="round" /></>);
const IconUser = () => iconWrap(<><circle cx="10" cy="7" r="3" /><path d="M4 16c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" strokeLinecap="round" /></>);
const IconCalendar = () => iconWrap(<><rect x="3" y="5" width="14" height="12" rx="1.5" /><path d="M3 9h14M7 3v4M13 3v4" strokeLinecap="round" /></>);
const IconAward = () => iconWrap(<><circle cx="10" cy="8" r="3.5" /><path d="M8 11l-2 6 4-2 4 2-2-6" strokeLinejoin="round" /></>);
const IconTag = () => iconWrap(<><path d="M3 3h6l8 8-6 6-8-8z" strokeLinejoin="round" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" /></>);
const IconPin = () => iconWrap(<><path d="M10 17s5-4.5 5-9a5 5 0 10-10 0c0 4.5 5 9 5 9z" strokeLinejoin="round" /><circle cx="10" cy="8" r="1.8" /></>);
const IconCog = () => iconWrap(<><circle cx="10" cy="10" r="2.5" /><path d="M10 3v2.5M10 14.5V17M3 10h2.5M14.5 10H17M5.4 5.4l1.8 1.8M12.8 12.8l1.8 1.8M14.6 5.4l-1.8 1.8M7.2 12.8l-1.8 1.8" strokeLinecap="round" /></>);
const IconShield = () => iconWrap(<><path d="M10 3l6 2v5c0 4-2.5 6.5-6 7-3.5-.5-6-3-6-7V5z" strokeLinejoin="round" /><path d="M7.5 10l2 2 3.5-4" strokeLinecap="round" strokeLinejoin="round" /></>);

const NAV: { href: string; label: string; icon: React.ReactNode; section?: string }[] = [
  { href: "/control-center", label: "Overview", icon: <IconGrid />, section: "Monitor" },
  { href: "/control-center/approvals", label: "Approvals", icon: <IconCheck /> },
  { href: "/control-center/reports", label: "Reports", icon: <IconChart /> },
  { href: "/control-center/audit-logs", label: "Audit Logs", icon: <IconList /> },
  { href: "/control-center/notifications", label: "Notifications", icon: <IconBell /> },
  { href: "/control-center/organizations", label: "Organizations", icon: <IconBuilding />, section: "Manage" },
  { href: "/control-center/users", label: "Users", icon: <IconUsers /> },
  { href: "/control-center/roles", label: "Roles", icon: <IconKey /> },
  { href: "/control-center/jobs", label: "Jobs", icon: <IconBriefcase /> },
  { href: "/control-center/applications", label: "Applications", icon: <IconDoc /> },
  { href: "/control-center/candidates", label: "Candidates", icon: <IconUser /> },
  { href: "/control-center/interviews", label: "Interviews", icon: <IconCalendar /> },
  { href: "/control-center/offers", label: "Offers", icon: <IconAward /> },
  { href: "/control-center/categories", label: "Categories", icon: <IconTag />, section: "Configure" },
  { href: "/control-center/locations", label: "Locations", icon: <IconPin /> },
  { href: "/control-center/settings", label: "Settings", icon: <IconCog /> },
  { href: "/control-center/security", label: "Security", icon: <IconShield /> },
];

/* ── Minimal SVG icons (stroke style, consistent) ── */

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
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d="M8 4H4v12h4M12 7l4 3-4 3M16 10H8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

/**
 * Admin chrome: polished dark sidebar with icons, section grouping,
 * and gradient active states. Hidden on /control-center/login.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/control-center/login") {
    return <div className="min-h-screen bg-slate-100">{children}</div>;
  }

  let lastSection = "";
  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#0a1628] text-slate-300 md:flex">
        {/* Brand header */}
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9" />
            <div>
              <p className="text-base font-bold text-white">TalentBridge</p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-400">
                Control Center
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav aria-label="Control center sections" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const showSection = item.section && item.section !== lastSection;
              lastSection = item.section ?? lastSection;
              return (
                <React.Fragment key={item.href}>
                  {showSection && (
                    <li className="px-3 pb-1 pt-4 first:pt-0">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                        {item.section}
                      </p>
                    </li>
                  )}
                  <li>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${
                        active
                          ? "bg-gradient-to-r from-brand-600/25 to-teal-500/10 font-medium text-white"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-500 to-teal-400"
                        />
                      )}
                      <span className={active ? "text-teal-300" : "text-slate-500 group-hover:text-slate-300"}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 px-3 py-3">
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile section nav */}
        <nav
          aria-label="Control center sections"
          className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-slate-200 bg-[#0a1628] px-3 py-2 md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                isActive(pathname, item.href)
                  ? "bg-white/10 font-medium text-white"
                  : "text-slate-400"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
