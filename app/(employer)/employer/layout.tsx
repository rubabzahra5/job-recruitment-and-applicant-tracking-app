import { Suspense } from "react";
import Link from "next/link";
import { EmployerNav } from "../_components/EmployerNav";
import { OrgSwitcher } from "../_components/OrgSwitcher";
import { getOrgContext, NoOrganizationError } from "../_lib/org";
import { Logo } from "@/components/Logo";

/**
 * Employer route group (/employer/*).
 * Protected by middleware (redirect-only). Server-side authorization for every
 * page/action happens via lib/rbac.ts — never trust client input.
 */

async function HeaderExtras() {
  try {
    const ctx = await getOrgContext(null);
    return <OrgSwitcher orgs={ctx.orgs} currentOrgId={ctx.orgId} />;
  } catch (e) {
    if (e instanceof NoOrganizationError) return null;
    throw e;
  }
}

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center">
            <Link href="/employer" aria-label="TalentBridge employer home">
              <Logo className="h-8 w-8" />
            </Link>
            <span className="ml-3 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Employer
            </span>
          </div>
          <Suspense>
            <HeaderExtras />
          </Suspense>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <Suspense>
            <EmployerNav />
          </Suspense>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
