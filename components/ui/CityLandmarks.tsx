/**
 * CityLandmarks — minimalist line-art SVG silhouettes, one per city.
 * Every city has a DISTINCT concept. Stroke style, currentColor,
 * viewBox 0 0 64 40, 2px stroke, round caps/joins.
 */

type LandmarkProps = { className?: string };

function Svg({ className = "", children }: LandmarkProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 40"
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

/** Karachi — Mazar-e-Quaid dome + skyline blocks */
export function KarachiLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="6" y="22" width="5" height="12" />
      <rect x="13" y="17" width="5" height="17" />
      <rect x="46" y="20" width="5" height="14" />
      <rect x="53" y="25" width="5" height="9" />
      <rect x="24" y="24" width="16" height="10" />
      <path d="M24 24 Q32 14 40 24" />
      <path d="M30 34 v-5 a2 2 0 0 1 4 0 v5" />
      <line x1="4" y1="34" x2="60" y2="34" />
    </Svg>
  );
}

/** Lahore — Badshahi Mosque: tall minarets + central dome */
export function LahoreLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <line x1="10" y1="34" x2="10" y2="10" />
      <circle cx="10" cy="8" r="2" />
      <line x1="54" y1="34" x2="54" y2="10" />
      <circle cx="54" cy="8" r="2" />
      <path d="M22 26 Q32 14 42 26" />
      <rect x="22" y="26" width="20" height="8" />
      <line x1="6" y1="34" x2="58" y2="34" />
    </Svg>
  );
}

/** Islamabad — Faisal Mosque: folded triangular shell */
export function IslamabadLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M14 34 L32 8 L50 34" />
      <path d="M24 34 L32 20 L40 34" />
      <line x1="52" y1="34" x2="52" y2="22" />
      <circle cx="52" cy="20" r="1.6" />
      <line x1="8" y1="34" x2="56" y2="34" />
    </Svg>
  );
}

/** Faisalabad — Ghanta Ghar clock tower */
export function FaisalabadLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="26" y="12" width="12" height="22" />
      <circle cx="32" cy="19" r="4" />
      <line x1="32" y1="19" x2="32" y2="16.5" />
      <line x1="32" y1="19" x2="34" y2="20" />
      <path d="M24 12 h16 l-2 -5 h-12 Z" />
      <line x1="18" y1="34" x2="46" y2="34" />
    </Svg>
  );
}

/** Multan — shrine with TALL blue dome + finial spike */
export function MultanLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="22" y="24" width="20" height="10" />
      <path d="M22 24 Q32 8 42 24" />
      <line x1="32" y1="8" x2="32" y2="4" />
      <circle cx="32" cy="3" r="1.2" />
      <path d="M28 34 v-4 a4 4 0 0 1 8 0 v4" />
      <line x1="16" y1="34" x2="48" y2="34" />
    </Svg>
  );
}

/** Rawalpindi — Metro bus arch (modern curve) */
export function RawalpindiLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M8 34 Q32 10 56 34" />
      <line x1="20" y1="27" x2="20" y2="34" />
      <line x1="32" y1="22" x2="32" y2="34" />
      <line x1="44" y1="27" x2="44" y2="34" />
      <line x1="4" y1="34" x2="60" y2="34" />
    </Svg>
  );
}

/** Peshawar — Bala Hisar: fort wall + Khyber arch gateway */
export function PeshawarLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="8" y="20" width="48" height="14" />
      <path d="M8 20 v-4 h5 v4 h5 v-4 h5 v4 h5 v-4 h5 v4 h5 v-4 h5 v4 h5 v-4 h3 v4" />
      <path d="M26 34 v-7 a6 6 0 0 1 12 0 v7" />
      <line x1="4" y1="34" x2="60" y2="34" />
    </Svg>
  );
}

/** Quetta — terraced hills (stepped, not zigzag) */
export function QuettaLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M6 34 h10 v-5 h10 v-5 h10 v-5 h10 v-4 h12" />
      <path d="M6 34 h52" />
      <path d="M16 29 v-5 M28 24 v-5 M40 19 v-4" />
      <circle cx="52" cy="10" r="3" />
    </Svg>
  );
}

/** Hyderabad — Pacco Qillo: round bastion towers */
export function HyderabadLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <circle cx="16" cy="26" r="6" />
      <circle cx="48" cy="26" r="6" />
      <rect x="16" y="26" width="32" height="8" />
      <path d="M28 26 v-5 h8 v5" />
      <line x1="6" y1="34" x2="58" y2="34" />
    </Svg>
  );
}

/** Gujranwala — grand gateway with small dome */
export function GujranwalaLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="16" width="28" height="18" />
      <path d="M24 34 v-9 a8 8 0 0 1 16 0 v9" />
      <path d="M28 16 q4 -8 8 0" />
      <line x1="18" y1="12" x2="46" y2="12" />
      <line x1="12" y1="34" x2="52" y2="34" />
    </Svg>
  );
}

/** Sialkot — tall fort watchtower */
export function SialkotLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <rect x="26" y="10" width="12" height="24" />
      <path d="M26 10 v-3 h3 v3 h3 v-3 h3 v3 h3 v-3 h3 v3" />
      <rect x="29" y="18" width="6" height="5" />
      <line x1="20" y1="34" x2="44" y2="34" />
    </Svg>
  );
}

/** Gilgit — Rakaposhi single sharp peak + suspension bridge */
export function GilgitLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M8 26 L24 6 L40 26" />
      <path d="M20 12 l4 -6 4 6" />
      <path d="M8 32 Q26 28 44 32" />
      <line x1="14" y1="30.5" x2="14" y2="32" />
      <line x1="26" y1="29.5" x2="26" y2="32" />
      <line x1="38" y1="30.5" x2="38" y2="32" />
      <line x1="4" y1="34" x2="48" y2="34" />
    </Svg>
  );
}

/** Muzaffarabad — Red Fort on hill with flag */
export function MuzaffarabadLandmark({ className = "" }: LandmarkProps) {
  return (
    <Svg className={className}>
      <path d="M6 34 Q20 30 30 24 Q42 30 58 34" />
      <rect x="24" y="14" width="18" height="10" />
      <path d="M24 14 v-3 h4 v3 h4 v-3 h4 v3 h6 v3" />
      <line x1="42" y1="14" x2="42" y2="7" />
      <path d="M42 7 h7 l-2 2.5 2 2.5 h-7" />
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
