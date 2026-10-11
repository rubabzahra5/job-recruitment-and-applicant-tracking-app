/**
 * TalentBridge logo mark — a bridge arch connecting two pillars,
 * symbolizing the connection between talent and employers.
 */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" role="img">
      <defs>
        <linearGradient id="tb-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f62c4" />
          <stop offset="100%" stopColor="#0a2f5c" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#tb-logo-grad)" />
      {/* bridge deck */}
      <rect x="8" y="15.5" width="24" height="3.2" rx="1.6" fill="#ffffff" />
      {/* arch */}
      <path
        d="M10.5 18.7 Q20 9.5 29.5 18.7"
        stroke="#ffffff"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      {/* pillars */}
      <rect x="9.2" y="18.7" width="2.8" height="9.3" rx="1.2" fill="#ffffff" />
      <rect x="28" y="18.7" width="2.8" height="9.3" rx="1.2" fill="#ffffff" />
      {/* water line */}
      <rect x="8" y="30" width="24" height="2" rx="1" fill="#ffffff" opacity="0.45" />
    </svg>
  );
}

/**
 * TalentBridge wordmark. Use `dark` on dark backgrounds.
 */
export function LogoWordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`text-lg font-extrabold tracking-tight ${
        dark ? "text-white" : "text-brand-900"
      }`}
    >
      Talent<span className={dark ? "text-teal-400" : "text-brand-600"}>Bridge</span>
    </span>
  );
}

/**
 * Full lockup: mark + wordmark.
 */
export function Logo({ dark = false, className = "h-9 w-9" }: { dark?: boolean; className?: string }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark className={className} />
      <LogoWordmark dark={dark} />
    </span>
  );
}
