import * as React from "react";
import type { LucideIcon } from "lucide-react";

/**
 * IconTile — a soft rounded-square tinted tile wrapping a single Lucide icon.
 * Use ONE icon set (Lucide), 1.75px stroke, rounded caps, everywhere.
 */

type IconTone = "blue" | "teal" | "amber" | "emerald" | "rose" | "slate" | "navy" | "violet" | "indigo";

const TONES: Record<IconTone, { tile: string; icon: string }> = {
  blue: { tile: "bg-blue-500/10", icon: "text-blue-600" },
  teal: { tile: "bg-teal-500/10", icon: "text-teal-600" },
  amber: { tile: "bg-amber-500/10", icon: "text-amber-600" },
  emerald: { tile: "bg-emerald-500/10", icon: "text-emerald-600" },
  rose: { tile: "bg-rose-500/10", icon: "text-rose-600" },
  slate: { tile: "bg-slate-500/10", icon: "text-slate-600" },
  navy: { tile: "bg-brand-900/10", icon: "text-brand-900" },
  violet: { tile: "bg-violet-500/10", icon: "text-violet-600" },
  indigo: { tile: "bg-indigo-500/10", icon: "text-indigo-600" },
};

const SIZES = {
  xs: { tile: "h-8 w-8 rounded-lg", icon: "h-4 w-4" },
  sm: { tile: "h-10 w-10 rounded-xl", icon: "h-5 w-5" },
  md: { tile: "h-12 w-12 rounded-xl", icon: "h-6 w-6" },
  lg: { tile: "h-16 w-16 rounded-2xl", icon: "h-8 w-8" },
} as const;

export interface IconTileProps {
  icon: LucideIcon;
  tone?: IconTone;
  size?: keyof typeof SIZES;
  className?: string;
  label?: string;
}

export function IconTile({ icon: Icon, tone = "blue", size = "md", className = "", label }: IconTileProps) {
  const t = TONES[tone];
  const s = SIZES[size];
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center ${s.tile} ${t.tile} ${className}`}
    >
      <Icon
        className={`${s.icon} ${t.icon}`}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      />
    </span>
  );
}
