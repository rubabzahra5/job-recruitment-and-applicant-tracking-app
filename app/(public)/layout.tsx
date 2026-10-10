/**
 * Public route group: marketing pages, job board, auth pages.
 * No authentication required. Later phases add the real pages here.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <span className="text-lg font-bold text-brand-700">HirePakistan</span>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        © 2026 HirePakistan
      </footer>
    </div>
  );
}
