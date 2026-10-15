import * as React from "react";

/**
 * Status pill: soft background fill + solid matching dot + label.
 * Text always uses the -700/-800 shade for WCAG AA on white (4.5:1+);
 * the -500 dot is decorative — color is never the only signal because
 * the label text is always present.
 *
 * Pipeline stage mapping (each stage has its own hue):
 *   Applied=blue, Screening=violet, Shortlisted=teal, Interview=amber,
 *   Offer=indigo, Hired=emerald, Rejected=rose
 */

type StatusTone = "emerald" | "amber" | "rose" | "slate" | "blue" | "teal" | "violet" | "indigo";

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
    pill: "bg-slate-500/10 text-slate-700 border-slate-500/25",
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
  violet: {
    pill: "bg-violet-500/10 text-violet-700 border-violet-500/25",
    dot: "bg-violet-500",
  },
  indigo: {
    pill: "bg-indigo-500/10 text-indigo-700 border-indigo-500/25",
    dot: "bg-indigo-500",
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

/** Map a pipeline stage key to its dedicated hue. */
export function stageTone(stageKey: string): StatusTone {
  const k = stageKey.toLowerCase();
  if (/(hired|accepted)/.test(k)) return "emerald";
  if (/(reject|declined|withdrawn)/.test(k)) return "rose";
  if (/(shortlist)/.test(k)) return "teal";
  if (/(screening)/.test(k)) return "violet";
  if (/(interview)/.test(k)) return "amber";
  if (/(offer)/.test(k)) return "indigo";
  if (/(applied|new)/.test(k)) return "blue";
  return "slate";
}
