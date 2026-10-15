import * as React from "react";

/**
 * Deterministic avatar: stable background color derived from the name,
 * initials in the foreground. Used for candidates, companies, and staff.
 */

const PALETTE = [
  "bg-blue-600",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-cyan-600",
  "bg-sky-600",
  "bg-violet-600",
  "bg-amber-600",
] as const;

/** Gradient pairs for the "gradient" variant — deterministic per name. */
const GRADIENTS = [
  "from-blue-600 to-teal-500",
  "from-indigo-600 to-blue-500",
  "from-teal-600 to-emerald-500",
  "from-sky-600 to-cyan-500",
  "from-violet-600 to-indigo-500",
  "from-amber-600 to-orange-500",
  "from-emerald-600 to-teal-500",
  "from-blue-700 to-indigo-600",
] as const;

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
  return `${(parts[0] ?? "").charAt(0)}${(parts[parts.length - 1] ?? "").charAt(0)}`.toUpperCase();
}

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

export interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  /**
   * "gradient" (default, premium) or "solid".
   * Solid is used automatically at xs size for legibility.
   */
  variant?: "solid" | "gradient";
}

export function Avatar({ name, size = "sm", className = "", variant }: AvatarProps) {
  const resolved = variant ?? (size === "xs" ? "solid" : "gradient");
  const idx = hashName(name) % PALETTE.length;
  const bg =
    resolved === "gradient"
      ? `bg-gradient-to-br ${GRADIENTS[idx]}`
      : PALETTE[idx];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${bg} ${SIZES[size]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
