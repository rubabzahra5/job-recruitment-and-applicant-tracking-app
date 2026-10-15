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
}

export function Avatar({ name, size = "sm", className = "" }: AvatarProps) {
  const color = PALETTE[hashName(name) % PALETTE.length];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${color} ${SIZES[size]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
