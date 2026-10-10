/**
 * Employer route group (/employer/*).
 * Protected by middleware (redirect-only). Server-side authorization for every
 * page/action happens via lib/rbac.ts — never trust client input.
 */
export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <span className="text-lg font-bold text-brand-700">HirePakistan</span>
          <span className="ml-3 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Employer
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
