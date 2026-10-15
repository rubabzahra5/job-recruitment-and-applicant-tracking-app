/**
 * Dividers — SVG section dividers using the signature bridge-arc motif.
 * Zero image files; pure SVG, currentColor-aware.
 */

export interface BridgeDividerProps {
  className?: string;
  /** Flip vertically (arc opens downward instead of upward). */
  flip?: boolean;
  /** Color of the arc line. Defaults to currentColor. */
  arcColor?: string;
}

/**
 * A curved bridge-arc divider to place between sections.
 * The arc above echoes the logo; the deck line grounds it.
 */
export function BridgeDivider({ className = "", flip = false, arcColor = "currentColor" }: BridgeDividerProps) {
  return (
    <div aria-hidden="true" className={`pointer-events-none w-full overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        className={`block h-[64px] w-full md:h-[90px] ${flip ? "rotate-180" : ""}`}
        fill="none"
      >
        {/* deck */}
        <rect x="0" y="58" width="1440" height="7" rx="3.5" fill={arcColor} opacity="0.18" />
        {/* arc */}
        <path
          d="M120 62 Q720 -30 1320 62"
          stroke={arcColor}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.35"
        />
        {/* pillars */}
        <rect x="380" y="34" width="7" height="31" rx="3.5" fill={arcColor} opacity="0.22" />
        <rect x="716" y="18" width="7" height="47" rx="3.5" fill={arcColor} opacity="0.22" />
        <rect x="1052" y="34" width="7" height="31" rx="3.5" fill={arcColor} opacity="0.22" />
      </svg>
    </div>
  );
}

export interface WaveDividerProps {
  className?: string;
  flip?: boolean;
  fill?: string;
}

/**
 * Simple curved wave divider for section transitions.
 * Pass fill to match the section below (e.g. "fill-white").
 */
export function WaveDivider({ className = "", flip = false, fill = "currentColor" }: WaveDividerProps) {
  return (
    <div aria-hidden="true" className={`pointer-events-none w-full overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        className={`block h-[48px] w-full md:h-[80px] ${flip ? "rotate-180" : ""}`}
      >
        <path
          d="M0 48 Q360 8 720 40 T1440 32 V80 H0 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
