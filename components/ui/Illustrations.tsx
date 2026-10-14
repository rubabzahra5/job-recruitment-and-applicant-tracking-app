/**
 * Professional inline SVG illustrations for TalentBridge.
 * No external dependencies — crisp at any size, theme-consistent.
 */

export function BridgeIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 260" fill="none" className={className} aria-hidden="true">
      {/* sky glow */}
      <ellipse cx="200" cy="130" rx="180" ry="110" fill="url(#bridgeGlow)" opacity="0.5" />
      {/* bridge arch */}
      <path
        d="M40 200 Q200 60 360 200"
        stroke="url(#bridgeGrad)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* deck */}
      <rect x="30" y="192" width="340" height="14" rx="7" fill="url(#bridgeGrad)" />
      {/* pillars */}
      <rect x="95" y="150" width="10" height="56" rx="5" fill="#0b4f9f" opacity="0.7" />
      <rect x="195" y="120" width="10" height="86" rx="5" fill="#0b4f9f" opacity="0.7" />
      <rect x="295" y="150" width="10" height="56" rx="5" fill="#0b4f9f" opacity="0.7" />
      {/* people dots crossing */}
      <circle cx="140" cy="185" r="9" fill="#2dd4bf" />
      <circle cx="220" cy="185" r="9" fill="#0f62c4" />
      <circle cx="270" cy="185" r="9" fill="#f59e0b" />
      {/* stars */}
      <circle cx="80" cy="60" r="4" fill="#fff" opacity="0.8" />
      <circle cx="330" cy="50" r="5" fill="#fff" opacity="0.6" />
      <circle cx="300" cy="90" r="3" fill="#2dd4bf" opacity="0.8" />
      <defs>
        <linearGradient id="bridgeGrad" x1="40" y1="200" x2="360" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f62c4" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
        <radialGradient id="bridgeGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f62c4" stopOpacity="0.35" />
          <stop offset="1" stopColor="#0f62c4" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function ShieldCheckIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <path
        d="M60 8 L102 24 V58 C102 86 84 104 60 112 C36 104 18 86 18 58 V24 L60 8Z"
        fill="url(#shieldGrad)"
        opacity="0.16"
      />
      <path
        d="M60 8 L102 24 V58 C102 86 84 104 60 112 C36 104 18 86 18 58 V24 L60 8Z"
        stroke="url(#shieldGrad)"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="M42 60 L55 73 L80 46"
        stroke="#0f62c4"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="shieldGrad" x1="18" y1="8" x2="102" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f62c4" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function NoFeeIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <circle cx="60" cy="60" r="48" fill="#2dd4bf" opacity="0.14" />
      <circle cx="60" cy="60" r="48" stroke="#2dd4bf" strokeWidth="5" />
      <path
        d="M38 82 L82 38"
        stroke="#ef4444"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <text
        x="60"
        y="76"
        textAnchor="middle"
        fontSize="38"
        fontWeight="800"
        fill="#0b4f9f"
        fontFamily="system-ui, sans-serif"
      >
        Rs
      </text>
    </svg>
  );
}

export function PakistanMapPin({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* stylized map pin */}
      <path
        d="M60 10 C86 10 104 30 104 54 C104 84 60 112 60 112 C60 112 16 84 16 54 C16 30 34 10 60 10Z"
        fill="url(#pinGrad)"
        opacity="0.16"
      />
      <path
        d="M60 10 C86 10 104 30 104 54 C104 84 60 112 60 112 C60 112 16 84 16 54 C16 30 34 10 60 10Z"
        stroke="url(#pinGrad)"
        strokeWidth="6"
      />
      <circle cx="60" cy="54" r="16" fill="url(#pinGrad)" />
      <circle cx="60" cy="54" r="7" fill="#fff" />
      <defs>
        <linearGradient id="pinGrad" x1="16" y1="10" x2="104" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f62c4" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function DocumentCheckIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <rect x="28" y="10" width="64" height="84" rx="8" fill="#eef6ff" stroke="#0f62c4" strokeWidth="5" />
      <line x1="42" y1="34" x2="78" y2="34" stroke="#0b4f9f" strokeWidth="6" strokeLinecap="round" opacity="0.4" />
      <line x1="42" y1="50" x2="78" y2="50" stroke="#0b4f9f" strokeWidth="6" strokeLinecap="round" opacity="0.25" />
      <line x1="42" y1="66" x2="66" y2="66" stroke="#0b4f9f" strokeWidth="6" strokeLinecap="round" opacity="0.25" />
      <circle cx="84" cy="84" r="22" fill="#2dd4bf" />
      <path d="M75 84 L81 90 L93 78" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatBubbleIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <rect x="14" y="20" width="92" height="62" rx="14" fill="#eef6ff" stroke="#0f62c4" strokeWidth="5" />
      <path d="M38 82 L30 102 L52 82" fill="#eef6ff" stroke="#0f62c4" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="38" cy="51" r="6" fill="#0f62c4" />
      <circle cx="60" cy="51" r="6" fill="#0f62c4" opacity="0.6" />
      <circle cx="82" cy="51" r="6" fill="#0f62c4" opacity="0.3" />
    </svg>
  );
}

export function GrowthChartIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <rect x="14" y="14" width="92" height="92" rx="12" fill="#eef6ff" />
      <path d="M28 88 L52 64 L68 74 L92 40" stroke="url(#chartGrad)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 40 H92 V60" stroke="url(#chartGrad)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="92" cy="40" r="7" fill="#2dd4bf" />
      <defs>
        <linearGradient id="chartGrad" x1="28" y1="88" x2="92" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f62c4" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
    </svg>
  );
}
