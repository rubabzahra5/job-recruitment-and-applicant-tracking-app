/**
 * HowItWorks illustrations — 3 steps: Create profile, Apply, Get hired.
 * Outline language: 2px brand stroke + ONE tinted fill max per illustration.
 * viewBox 0 0 120 120, brand colors only.
 */

type P = { className?: string };

function Frame({ className = "", children }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="#0b4f9f"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Step 1 — Create profile: user outline + pencil, one tinted fill */
export function CreateProfileIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <circle cx="52" cy="44" r="16" fill="#eef6ff" />
      <path d="M28 96 c4 -16 13 -24 24 -24 s20 8 24 24" fill="#eef6ff" />
      <line x1="78" y1="62" x2="94" y2="92" strokeWidth={5} />
      <path d="M90 86 l8 4 -5 7 Z" fill="#f59e0b" stroke="none" />
      <path d="M14 100 Q60 66 106 100" strokeWidth={2.5} opacity={0.35} />
    </Frame>
  );
}

/** Step 2 — Apply: paper plane outline over bridge arc */
export function ApplyIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <path d="M16 94 Q60 62 104 94" strokeWidth={2.5} opacity={0.35} />
      <path d="M34 60 L88 38 L66 90 L58 70 Z" fill="#eef6ff" />
      <line x1="58" y1="70" x2="88" y2="38" strokeWidth={2.5} />
      <line x1="24" y1="46" x2="36" y2="50" stroke="#0f766e" strokeWidth={3} />
      <line x1="20" y1="60" x2="30" y2="61" stroke="#0f766e" strokeWidth={3} />
    </Frame>
  );
}

/** Step 3 — Get hired: medal outline, single amber fill */
export function GetHiredIllustration({ className = "" }: P) {
  return (
    <Frame className={className}>
      <path d="M46 24 L60 52 L74 24" strokeWidth={6} />
      <circle cx="60" cy="70" r="22" fill="#fef3c7" />
      <path d="M51 70 l6.5 6.5 L71 62" strokeWidth={5} />
      <circle cx="32" cy="38" r="2.5" fill="#0f766e" stroke="none" />
      <circle cx="90" cy="42" r="3" fill="#0f766e" stroke="none" opacity={0.6} />
    </Frame>
  );
}
