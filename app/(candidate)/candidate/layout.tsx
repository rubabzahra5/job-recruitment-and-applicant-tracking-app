import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { PortalNav } from "@/app/(candidate)/_components/PortalNav";
import { SignOutButton } from "@/app/(candidate)/_components/SignOutButton";

export const metadata: Metadata = { title: "Candidate Portal" };

/**
 * Candidate portal shell: brand header + sidebar navigation.
 * The middleware redirects unauthenticated visitors; every page/action
 * additionally enforces requireCandidate() (DB-backed role check) server-side.
 */
export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/candidate" className="flex items-center gap-2">
            <span className="text-lg font-bold text-brand-700">HirePakistan</span>
            <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              Candidate
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {user?.email && (
              <span className="hidden max-w-56 truncate text-sm text-slate-600 sm:block">
                {user.email}
              </span>
            )}
            {user && <SignOutButton />}
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-6 rounded-lg border border-slate-200 bg-white p-3">
            <PortalNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-4 md:hidden">
            <details className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
                Portal menu
              </summary>
              <div className="border-t border-slate-100 p-3">
                <PortalNav />
              </div>
            </details>
          </div>
          {children}
        </main>
      </div>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500">
          Your profile is private by default — employers only see your details
          when you apply or opt into searchability.
        </div>
      </footer>
    </div>
  );
}
