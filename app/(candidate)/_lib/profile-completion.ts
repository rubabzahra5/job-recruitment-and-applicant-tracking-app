import type { CandidateProfile } from "./candidate-guard";

/**
 * Profile completion scoring for the candidate portal.
 *
 * A weighted checklist over the candidate's own data. Weights sum to 100.
 * Languages and portfolio links share the `candidate_profiles.portfolio_links`
 * jsonb column (see the convention documented in the profile actions):
 *   { kind: "link", label, url } | { kind: "language", language, proficiency }
 * Plain-string entries are treated as legacy links.
 */

export interface CompletionInput {
  profile: CandidateProfile | null;
  educationCount: number;
  experienceCount: number;
  skillsCount: number;
  hasCurrentCv: boolean;
}

export interface CompletionCheck {
  label: string;
  done: boolean;
  weight: number;
}

export interface CompletionResult {
  percent: number;
  missing: string[];
  checks: CompletionCheck[];
}

function portfolioItems(raw: unknown): Array<Record<string, unknown> | string> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is Record<string, unknown> | string =>
      typeof item === "string" || (typeof item === "object" && item !== null),
  );
}

export function hasPortfolioOrLanguage(raw: unknown): boolean {
  const items = portfolioItems(raw);
  if (items.length === 0) return false;
  return items.some((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    const kind = item.kind;
    if (kind === "language") return Boolean(item.language);
    if (kind === "link") return Boolean(item.url);
    // Legacy / unknown object shape: count it if it carries any value.
    return Object.values(item).some(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
  });
}

export function computeProfileCompletion(
  input: CompletionInput,
): CompletionResult {
  const p = input.profile;
  const checks: CompletionCheck[] = [
    {
      label: "Full name",
      done: Boolean(p?.full_name?.trim()),
      weight: 5,
    },
    {
      label: "Headline",
      done: Boolean(p?.headline?.trim()),
      weight: 10,
    },
    {
      label: "Phone number",
      done: Boolean(p?.phone?.trim()),
      weight: 10,
    },
    {
      label: "City & province",
      done: Boolean(p?.city?.trim()) && Boolean(p?.province?.trim()),
      weight: 10,
    },
    {
      label: "Professional summary",
      done: Boolean(p?.summary?.trim()),
      weight: 10,
    },
    {
      label: "Education history",
      done: input.educationCount > 0,
      weight: 10,
    },
    {
      label: "Work experience",
      done: input.experienceCount > 0,
      weight: 10,
    },
    {
      label: "Skills (at least 3)",
      done: input.skillsCount >= 3,
      weight: 10,
    },
    {
      label: "Current CV uploaded",
      done: input.hasCurrentCv,
      weight: 10,
    },
    {
      label: "Portfolio link or language",
      done: hasPortfolioOrLanguage(p?.portfolio_links),
      weight: 5,
    },
    {
      label: "Salary / availability preferences",
      done:
        p?.expected_salary != null ||
        Boolean(p?.availability?.trim()) ||
        p?.notice_period_days != null,
      weight: 5,
    },
  ];
  const percent = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
  const missing = checks.filter((c) => !c.done).map((c) => c.label);
  return { percent, missing, checks };
}
