import * as React from "react";

/**
 * Status pill: soft background fill + solid matching dot + label.
 * e.g. emerald for verified/hired, amber for pending/screening,
 * rose for rejected/alerts, slate for neutral, blue for info.
 */

type StatusTone = "emerald" | "amber" | "rose" | "slate" | "blue" | "teal";

const TONES: Record<StatusTone, { pill: string; dot: string }> = {
  emerald: {
    pill: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  amber: {
    pill: "bg-amber-500/10 text-amber-800 border-amber-500/25",
    dot: "bg-amber-500",
  },
  rose: {
    pill: "bg-rose-500/10 text-rose-700 border-rose-500/25",
    dot: "bg-rose-500",
  },
  slate: {
    pill: "bg-slate-500/10 text-slate-600 border-slate-500/25",
    dot: "bg-slate-400",
  },
  blue: {
    pill: "bg-blue-500/10 text-blue-700 border-blue-500/25",
    dot: "bg-blue-500",
  },
  teal: {
    pill: "bg-teal-500/10 text-teal-700 border-teal-500/25",
    dot: "bg-teal-500",
  },
};

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  dotPulse?: boolean;
}

export function StatusPill({ tone = "slate", dotPulse = false, className = "", children, ...rest }: StatusPillProps) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${t.pill} ${className}`}
      {...rest}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${t.dot} ${dotPulse ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}

/** Map a pipeline stage key to a status tone. */
export function stageTone(stageKey: string): StatusTone {
  const k = stageKey.toLowerCase();
  if (/(hired|offer_accepted|accepted)/.test(k)) return "emerald";
  if (/(reject|declined|withdrawn)/.test(k)) return "rose";
  if (/(applied|new|screening)/.test(k)) return "blue";
  if (/(interview)/.test(k)) return "amber";
  if (/(offer)/.test(k)) return "teal";
  return "slate";
}
