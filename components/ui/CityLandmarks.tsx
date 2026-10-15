/**
 * CityLandmarks — minimalist line-art SVG silhouettes, one per city.
 * Stroke style, currentColor, viewBox 0 0 120 60. Flat, subtle, brand-safe.
 */

type LandmarkProps = { className?: string };

function Svg({ className = "", children }: LandmarkProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Karachi — Mazar-e-Quaid: dome on cuboid base with arched doorway */
export function KarachiLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="34" width="60" height="18" />
      <path d="M30 34 Q60 6 90 34" />
      <path d="M52 52 v-10 a8 8 0 0 1 16 0 v10" />
      <line x1="18" y1="52" x2="102" y2="52" />
    </Svg>
  );
}

/** Lahore — Badshahi Mosque: three domes + minarets */
export function LahoreLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="24" y="36" width="72" height="14" />
      <path d="M36 36 q6 -14 12 0 M54 36 q6 -14 12 0 M72 36 q6 -14 12 0" />
      <line x1="18" y1="50" x2="18" y2="22" />
      <line x1="102" y1="50" x2="102" y2="22" />
      <circle cx="18" cy="20" r="2.5" />
      <circle cx="102" cy="20" r="2.5" />
      <line x1="12" y1="52" x2="108" y2="52" />
    </Svg>
  );
}

/** Islamabad — Faisal Mosque: tent-like folded planes + minarets */
export function IslamabadLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M28 50 L60 12 L92 50" />
      <path d="M44 50 L60 26 L76 50" />
      <line x1="22" y1="50" x2="22" y2="30" />
      <line x1="98" y1="50" x2="98" y2="30" />
      <line x1="14" y1="52" x2="106" y2="52" />
    </Svg>
  );
}

/** Faisalabad — Clock Tower (Ghanta Ghar): tower with clock face */
export function FaisalabadLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="50" y="18" width="20" height="32" />
      <circle cx="60" cy="28" r="6" />
      <line x1="60" y1="28" x2="60" y2="24" />
      <line x1="60" y1="28" x2="63" y2="29" />
      <path d="M46 18 L74 18 L70 10 L50 10 Z" />
      <line x1="40" y1="52" x2="80" y2="52" />
    </Svg>
  );
}

/** Multan — Shrine: domed tomb with arched entrance */
export function MultanLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="38" y="34" width="44" height="16" />
      <path d="M38 34 Q60 12 82 34" />
      <path d="M54 50 v-8 a6 6 0 0 1 12 0 v8" />
      <line x1="30" y1="52" x2="90" y2="52" />
    </Svg>
  );
}

/** Rawalpindi — old bazaar gate arch */
export function RawalpindiLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M30 52 V28 Q60 10 90 28 V52" />
      <path d="M44 52 V34 Q60 24 76 34 V52" />
      <line x1="22" y1="52" x2="98" y2="52" />
    </Svg>
  );
}

/** Peshawar — Bala Hisar Fort: crenellated walls */
export function PeshawarLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="26" y="30" width="68" height="20" />
      <path d="M26 30 v-6 h8 v6 h8 v-6 h8 v6 h8 v-6 h8 v6 h8 v-6 h8 v6 h8 v-6" />
      <rect x="52" y="38" width="16" height="12" />
      <line x1="18" y1="52" x2="102" y2="52" />
    </Svg>
  );
}

/** Quetta — mountain valley peaks */
export function QuettaLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M10 50 L38 20 L52 36 L68 14 L86 34 L100 26 L110 50" />
      <path d="M32 28 l6 -8 6 8 M62 22 l6 -8 6 8" />
      <line x1="10" y1="52" x2="110" y2="52" />
    </Svg>
  );
}

/** Hyderabad — Pacco Qillo ramparts */
export function HyderabadLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M20 50 V34 h12 v-6 h12 v6 h12 v-6 h12 v6 h12 v-6 h12 v6 h8 v16" />
      <line x1="14" y1="52" x2="106" y2="52" />
    </Svg>
  );
}

/** Gujranwala — food street archway with dome */
export function GujranwalaLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="32" width="52" height="18" />
      <path d="M42 32 q5 -12 10 0 M56 32 q5 -12 10 0 M70 32 q5 -12 10 0" />
      <path d="M54 50 v-10 a6 6 0 0 1 12 0 v10" />
      <line x1="26" y1="52" x2="94" y2="52" />
    </Svg>
  );
}

/** Sialkot — sports goods: cricket bat + ball motif over skyline */
export function SialkotLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="24" y="38" width="72" height="12" />
      <path d="M36 38 v-8 h10 v8 M74 38 v-8 h10 v8" />
      <circle cx="60" cy="24" r="5" />
      <line x1="14" y1="52" x2="106" y2="52" />
    </Svg>
  );
}

/** Gilgit — Karakoram peaks with river */
export function GilgitLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M8 48 L34 14 L50 32 L66 10 L84 30 L96 20 L112 48" />
      <path d="M28 24 l6 -10 6 10 M60 20 l6 -10 6 10" />
      <path d="M8 54 q14 -4 28 0 t28 0 t28 0 t20 0" />
    </Svg>
  );
}

/** Muzaffarabad — Red Fort on hill */
export function MuzaffarabadLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M10 52 Q40 44 60 30 Q80 44 110 52" />
      <rect x="44" y="18" width="32" height="14" />
      <path d="M44 18 v-4 h6 v4 h6 v-4 h6 v4 h6 v-4 h8 v4" />
      <line x1="10" y1="54" x2="110" y2="54" />
    </Svg>
  );
}

/** Slug -> component map for dynamic rendering */
export const CITY_LANDMARKS: Record<string, React.ComponentType<LandmarkProps>> = {
  karachi: KarachiLandmark,
  lahore: LahoreLandmark,
  islamabad: IslamabadLandmark,
  faisalabad: FaisalabadLandmark,
  multan: MultanLandmark,
  rawalpindi: RawalpindiLandmark,
  peshawar: PeshawarLandmark,
  quetta: QuettaLandmark,
  hyderabad: HyderabadLandmark,
  gujranwala: GujranwalaLandmark,
  sialkot: SialkotLandmark,
  gilgit: GilgitLandmark,
  muzaffarabad: MuzaffarabadLandmark,
};
