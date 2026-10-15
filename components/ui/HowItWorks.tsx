/**
 * HowItWorks illustrations — 3 steps: Create profile, Apply, Get hired.
 * viewBox 0 0 120 120, flat style, brand palette, bridge motif.
 */

type P = { className?: string };

function Frame({ className = "", children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

/** Step 1 — Create profile: user silhouette + pencil */
export function CreateProfileIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <circle cx="60" cy="60" r="46" fill="#eef6ff" />
      <circle cx="54" cy="48" r="14" fill="#0f62c4" opacity="0.85" />
      <path d="M32 88 c4 -14 12 -20 22 -20 s18 6 22 20" fill="#0f62c4" opacity="0.85" />
      {/* pencil */}
      <rect x="78" y="66" width="10" height="30" rx="2" transform="rotate(35 83 81)" fill="#f59e0b" />
      <path d="M86 92 l8 4 -6 6 Z" fill="#0b4f9f" transform="rotate(35 83 81)" />
      <circle cx="60" cy="60" r="46" stroke="#0f62c4" strokeWidth="4" opacity="0.25" />
    </Frame>
  );
}

/** Step 2 — Apply: paper plane over bridge arc */
export function ApplyIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <circle cx="60" cy="60" r="46" fill="#eef6ff" />
      <path d="M18 92 Q60 60 102 92" stroke="#0f62c4" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
      {/* paper plane */}
      <path d="M34 62 L86 40 L66 88 L58 70 Z" fill="#0f62c4" />
      <path d="M58 70 L86 40" stroke="#fff" strokeWidth="2.5" />
      <path d="M34 62 L58 70 L52 78 Z" fill="#0b4f9f" opacity="0.6" />
      {/* motion lines */}
      <line x1="24" y1="48" x2="36" y2="52" stroke="#2dd4bf" strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="62" x2="30" y2="63" stroke="#2dd4bf" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="60" r="46" stroke="#0f62c4" strokeWidth="4" opacity="0.25" />
    </Frame>
  );
}

/** Step 3 — Get hired: award medal with bridge ribbon */
export function GetHiredIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <circle cx="60" cy="60" r="46" fill="#eef6ff" />
      {/* ribbon */}
      <path d="M48 26 L60 52 L72 26" stroke="#f59e0b" strokeWidth="8" strokeLinejoin="round" />
      {/* medal */}
      <circle cx="60" cy="68" r="20" fill="#f59e0b" />
      <circle cx="60" cy="68" r="20" stroke="#b45309" strokeWidth="3" />
      <path d="M52 68 l6 6 l11 -12" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* sparkles */}
      <circle cx="34" cy="40" r="3" fill="#2dd4bf" />
      <circle cx="88" cy="44" r="4" fill="#0f62c4" opacity="0.5" />
      <circle cx="60" cy="60" r="46" stroke="#0f62c4" strokeWidth="4" opacity="0.25" />
    </Frame>
  );
}
