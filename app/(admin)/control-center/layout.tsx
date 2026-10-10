/**
 * Admin route group (/control-center/*).
 * Protected by middleware (redirect-only). Server-side authorization for every
 * page/action happens via lib/rbac.ts — never trust client input.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-slate-950">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <span className="text-lg font-bold text-white">HirePakistan</span>
          <span className="ml-3 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            Control Center
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
