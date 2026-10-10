/**
 * Formatting helpers.
 *
 * Conventions:
 * - Money: PKR amounts render as "Rs 85,000" (Indian-style digit grouping is
 *   standard in Pakistan, e.g. Rs 10,00,000).
 * - Display timezone: Asia/Karachi. All timestamps are STORED in UTC
 *   (timestamptz columns); convert only at the display boundary.
 */

export const DISPLAY_TIMEZONE = "Asia/Karachi";
export const CURRENCY = "PKR";

/**
 * Pakistani (Indian-style) digit grouping: 85000 -> "85,000",
 * 100000 -> "1,00,000" (one lakh), 10000000 -> "1,00,00,000" (one crore).
 * Node's en-PK Intl data uses western grouping, so this is done manually to
 * match how PKR amounts are actually written in Pakistan.
 */
function groupPakistaniDigits(n: number): string {
  const s = String(Math.abs(Math.round(n)));
  if (s.length <= 3) return (n < 0 ? "-" : "") + s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return (n < 0 ? "-" : "") + [...groups, last3].join(",");
}

/** 85000 -> "Rs 85,000"; 1500000 -> "Rs 15,00,000" */
export function formatPKR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return `Rs ${groupPakistaniDigits(n)}`;
}

/** Salary range: "Rs 80,000 – Rs 120,000 / month" (omits missing ends). */
export function formatSalaryRange(
  min: number | string | null | undefined,
  max: number | string | null | undefined,
  period: string = "monthly",
): string {
  const hasMin = min !== null && min !== undefined && min !== "";
  const hasMax = max !== null && max !== undefined && max !== "";
  if (!hasMin && !hasMax) return "Not disclosed";
  const periodLabel =
    period === "monthly" ? "month" : period === "annual" ? "year" : period === "hourly" ? "hour" : "project";
  if (hasMin && hasMax) return `${formatPKR(min)} – ${formatPKR(max)} / ${periodLabel}`;
  return `${formatPKR(hasMin ? min : max)} / ${periodLabel}`;
}

/** Format a UTC timestamp for display in Asia/Karachi. */
export function formatDateKarachi(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PK", { ...options, timeZone: DISPLAY_TIMEZONE }).format(d);
}

/** Date-only display in Asia/Karachi, e.g. "12 Oct 2026". */
export function formatDateOnlyKarachi(value: Date | string | null | undefined): string {
  return formatDateKarachi(value, { day: "numeric", month: "short", year: "numeric" });
}

/** Current instant. Store this (timestamptz) — Postgres keeps it in UTC. */
export function nowUTC(): Date {
  return new Date();
}

/**
 * Interpret a wall-clock datetime typed by a user in Pakistan as an instant.
 * `dateTimeLocal` is "YYYY-MM-DDTHH:mm" as produced by <input type="datetime-local">.
 * NOTE: Asia/Karachi has no DST, so a fixed +05:00 offset is correct.
 */
export function karachiWallClockToUTC(dateTimeLocal: string): Date {
  const d = new Date(`${dateTimeLocal}:00+05:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date/time.");
  return d;
}

/** Relative time ("3 days ago") for activity feeds. */
export function timeAgo(value: Date | string | null | undefined, now: Date = new Date()): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDateOnlyKarachi(d);
}
