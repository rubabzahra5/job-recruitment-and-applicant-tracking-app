/**
 * StateIllustrations — recolorable flat SVG illustrations for empty,
 * success, and error states. viewBox 0 0 120 120, brand palette,
 * bridge-arc motif where fitting. Matches Illustrations.tsx style.
 */

type P = { className?: string };

function Frame({ className = "", children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

/** Empty search: magnifier over a bridge arc */
export function EmptySearchIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <path d="M14 92 Q60 52 106 92" stroke="#0f62c4" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
      <rect x="12" y="88" width="96" height="6" rx="3" fill="#0f62c4" opacity="0.2" />
      <circle cx="58" cy="52" r="20" stroke="#0b4f9f" strokeWidth="6" />
      <line x1="73" y1="67" x2="88" y2="82" stroke="#0b4f9f" strokeWidth="7" strokeLinecap="round" />
      <circle cx="52" cy="48" r="4" fill="#2dd4bf" opacity="0.7" />
    </Frame>
  );
}

/** No applications: inbox tray with bridge arc */
export function NoApplicationsIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <path d="M20 78 Q60 48 100 78" stroke="#0f62c4" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
      <path d="M28 52 h64 l-8 26 h-48 Z" fill="#eef6ff" stroke="#0f62c4" strokeWidth="5" strokeLinejoin="round" />
      <line x1="40" y1="62" x2="80" y2="62" stroke="#0b4f9f" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
      <line x1="44" y1="70" x2="68" y2="70" stroke="#0b4f9f" strokeWidth="4" strokeLinecap="round" opacity="0.2" />
      <circle cx="88" cy="40" r="10" fill="#2dd4bf" opacity="0.5" />
    </Frame>
  );
}

/** No saved jobs: bookmark outline */
export function NoSavedJobsIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <path
        d="M42 22 h36 v62 l-18 -12 l-18 12 Z"
        fill="#eef6ff"
        stroke="#0f62c4"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <line x1="52" y1="44" x2="68" y2="44" stroke="#0b4f9f" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
      <circle cx="88" cy="88" r="12" fill="none" stroke="#2dd4bf" strokeWidth="4" strokeDasharray="5 5" />
    </Frame>
  );
}

/** Success: emerald circle check */
export function SuccessCheckIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <circle cx="60" cy="60" r="42" fill="#10b981" opacity="0.12" />
      <circle cx="60" cy="60" r="42" stroke="#10b981" strokeWidth="6" />
      <path d="M42 61 l13 13 l24 -28" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** 404: bridge under construction — arc with gap + caution barrier */
export function NotFound404Illustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      {/* broken arc */}
      <path d="M14 84 Q38 56 54 62" stroke="#0f62c4" strokeWidth="6" strokeLinecap="round" />
      <path d="M66 62 Q82 56 106 84" stroke="#0f62c4" strokeWidth="6" strokeLinecap="round" />
      <rect x="12" y="80" width="96" height="6" rx="3" fill="#0f62c4" opacity="0.25" />
      {/* barrier */}
      <rect x="46" y="44" width="28" height="12" rx="2" fill="#f59e0b" />
      <line x1="50" y1="44" x2="56" y2="56" stroke="#fff" strokeWidth="3" />
      <line x1="60" y1="44" x2="66" y2="56" stroke="#fff" strokeWidth="3" />
      <line x1="70" y1="44" x2="76" y2="56" stroke="#fff" strokeWidth="3" />
      <text x="60" y="102" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0b4f9f" fontFamily="system-ui, sans-serif">
        404
      </text>
    </Frame>
  );
}

/** 500: friendly cloud with wrench, bridge arc below */
export function ServerError500Illustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <path
        d="M34 64 a14 14 0 0 1 2 -28 a18 18 0 0 1 35 -4 a14 14 0 0 1 17 18 a12 12 0 0 1 -8 14 Z"
        fill="#eef6ff"
        stroke="#0f62c4"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="52" r="4" fill="#f59e0b" />
      <path d="M60 56 v6 M57 62 h6" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      <path d="M20 92 Q60 72 100 92" stroke="#0f62c4" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
      <text x="60" y="110" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0b4f9f" fontFamily="system-ui, sans-serif">
        500
      </text>
    </Frame>
  );
}
