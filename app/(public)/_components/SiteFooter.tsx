import Link from "next/link";

const SEEKER_LINKS = [
  { href: "/jobs", label: "Browse jobs" },
  { href: "/categories", label: "Job categories" },
  { href: "/locations", label: "Jobs by city" },
  { href: "/companies", label: "Companies" },
  { href: "/search", label: "Advanced search" },
];

const COMPANY_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#0e2a47] text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-white">
            Hire<span className="text-teal-400">Pakistan</span>
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
            Pakistan&apos;s employment portal connecting job seekers with verified
            employers — from Karachi to Khyber, across every industry.
          </p>
        </div>
        <nav aria-label="Job seekers">
          <p className="text-sm font-semibold uppercase tracking-wide text-white">Job seekers</p>
          <ul className="mt-3 space-y-2 text-sm">
            {SEEKER_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Employers">
          <p className="text-sm font-semibold uppercase tracking-wide text-white">Employers</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/register?type=employer" className="hover:text-white hover:underline">
                Post a job
              </Link>
            </li>
            <li>
              <Link href="/companies" className="hover:text-white hover:underline">
                Featured employers
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white hover:underline">
                Talk to sales
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Company">
          <p className="text-sm font-semibold uppercase tracking-wide text-white">Company</p>
          <ul className="mt-3 space-y-2 text-sm">
            {COMPANY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row">
          <p>© 2026 Job Recruitment And Applicant Tracking System. All rights reserved.</p>
          <p>Built for Pakistan&apos;s workforce · All amounts in PKR</p>
        </div>
      </div>
    </footer>
  );
}
