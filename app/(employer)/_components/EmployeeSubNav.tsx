import Link from "next/link";

const LINKS = [
  { href: "", label: "Home" },
  { href: "/profile", label: "My profile" },
  { href: "/documents", label: "My documents" },
  { href: "/requests", label: "HR requests" },
  { href: "/settings", label: "Settings" },
];

/** Employee portal sub-navigation (preserves ?org=). */
export function EmployeeSubNav({ orgId, current }: { orgId: string; current: string }) {
  return (
    <nav aria-label="Employee portal" className="flex flex-wrap gap-1 border-b border-slate-200">
      {LINKS.map((l) => {
        const href = `/employer/employee${l.href}?org=${encodeURIComponent(orgId)}`;
        const active = current === l.href;
        return (
          <Link
            key={l.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
