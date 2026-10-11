import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { getDashboardPath } from "../_lib/dashboard";
import { SignOutButton } from "./SignOutButton";

const NAV_LINKS = [
  { href: "/jobs", label: "Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/categories", label: "Categories" },
  { href: "/locations", label: "Locations" },
  { href: "/about", label: "About" },
];

/**
 * Auth-aware public header. Session roles are read server-side from the
 * user_roles table (lib/rbac.ts) — never from client input.
 * No /control-center link appears in public navigation.
 */
export async function SiteHeader() {
  const user = await getSessionUser();
  let dashboardPath: string | null = null;
  if (user) {
    try {
      dashboardPath = await getDashboardPath(user.id);
    } catch {
      dashboardPath = "/candidate";
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="TalentBridge home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user && dashboardPath ? (
            <>
              <Link
                href={dashboardPath}
                className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav aria-label="Primary mobile" className="border-t border-slate-100 md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
