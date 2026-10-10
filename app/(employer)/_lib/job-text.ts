/**
 * Job description section helpers.
 *
 * The jobs table has no dedicated benefits/instructions columns, so the job
 * form captures them as labeled, machine-readable sections inside
 * `description`. Markers round-trip deterministically (parse on edit, strip
 * on save, re-append).
 */

export const BENEFITS_START = "<!-- BENEFITS -->";
export const BENEFITS_END = "<!-- /BENEFITS -->";
export const INSTRUCTIONS_START = "<!-- INSTRUCTIONS -->";
export const INSTRUCTIONS_END = "<!-- /INSTRUCTIONS -->";

export function extractSection(text: string, start: string, end: string): string {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s === -1 || e === -1 || e < s) return "";
  return text.slice(s + start.length, e).trim();
}

export function removeSection(text: string, start: string, end: string): string {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s === -1 || e === -1 || e < s) return text;
  return (text.slice(0, s) + text.slice(e + end.length)).replace(/\n{3,}/g, "\n\n").trim();
}

export function withSection(text: string, start: string, end: string, body: string): string {
  const clean = removeSection(text, start, end);
  const trimmed = body.trim();
  if (!trimmed) return clean;
  const section = `${start}\n${trimmed}\n${end}`;
  return clean ? `${clean}\n\n${section}` : section;
}

export function splitJobDescription(description: string): {
  description: string;
  benefits: string;
  instructions: string;
} {
  return {
    benefits: extractSection(description, BENEFITS_START, BENEFITS_END),
    instructions: extractSection(description, INSTRUCTIONS_START, INSTRUCTIONS_END),
    description: removeSection(
      removeSection(description, BENEFITS_START, BENEFITS_END),
      INSTRUCTIONS_START,
      INSTRUCTIONS_END,
    ),
  };
}

export function joinJobDescription(parts: {
  description: string;
  benefits: string;
  instructions: string;
}): string {
  let text = parts.description.trim();
  text = withSection(text, BENEFITS_START, BENEFITS_END, parts.benefits);
  text = withSection(text, INSTRUCTIONS_START, INSTRUCTIONS_END, parts.instructions);
  return text;
}

/** "YYYY-MM-DDTHH:mm" wall-clock string in Asia/Karachi from a UTC instant. */
export function utcToKarachiInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Slugify a job title for the unique slug column. */
export function slugifyTitle(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "job";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
