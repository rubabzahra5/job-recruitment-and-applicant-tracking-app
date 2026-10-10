/**
 * Shared data access for the public portal (Agent A territory).
 *
 * Every query here goes through the request-bound server client, so Row Level
 * Security applies. Public job reads additionally enforce the platform's
 * "live job" rule, which is stricter than the base RLS policy:
 *
 *   status = 'published'
 *   AND (deadline IS NULL OR deadline > now())
 *   AND org.account_status = 'active'   (via organization_public_profiles)
 *
 * Never show expired, unpublished, suspended, or unauthorized vacancies.
 * No hardcoded jobs, employers, salaries, or stats anywhere in this group.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Db = SupabaseClient;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface JobRow {
  id: string;
  org_id: string;
  category_id: string | null;
  location_id: string | null;
  title: string;
  slug: string;
  description: string;
  responsibilities: string | null;
  qualifications: string | null;
  skills: string[];
  experience_min_years: number | null;
  experience_max_years: number | null;
  education_level: string | null;
  employment_type: string;
  workplace: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string;
  salary_disclosed: boolean;
  openings: number;
  is_fresh_graduate_ok: boolean;
  deadline: string | null;
  published_at: string | null;
  created_at: string;
}

export interface PublicOrg {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  about: string | null;
  industry: string | null;
  website: string | null;
  size_range: string | null;
  verification_status: string;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface PublicLocation {
  id: string;
  city: string;
  province: string;
  country: string;
}

export interface PublicJob extends JobRow {
  org: PublicOrg | null;
  category: PublicCategory | null;
  location: PublicLocation | null;
}

export interface JobQuestion {
  id: string;
  question: string;
  is_required: boolean;
  sort_order: number;
}

export interface JobSearchFilters {
  q?: string;
  company?: string;
  /** Exact organization id — takes precedence over the company name search. */
  orgId?: string;
  cityId?: string;
  province?: string;
  categorySlug?: string;
  employmentType?: string;
  experienceLevel?: "entry" | "mid" | "senior";
  education?: string;
  minSalary?: number;
  workplace?: string;
  freshOnly?: boolean;
  postedWithinDays?: number;
  sort?: "relevance" | "newest" | "deadline" | "salary";
  page?: number;
  perPage?: number;
}

export interface JobSearchResult {
  jobs: PublicJob[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  temporary: "Temporary",
  internship: "Internship",
  apprenticeship: "Apprenticeship",
  freelance: "Freelance",
};

export const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_LABELS);

export const WORKPLACE_LABELS: Record<string, string> = {
  on_site: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

export const EDUCATION_OPTIONS = [
  "Matric",
  "Intermediate",
  "Bachelor",
  "Master",
  "MPhil",
  "PhD",
  "Diploma",
];

export const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu and Kashmir",
];

export const POSTED_WITHIN_OPTIONS = [
  { value: 1, label: "Last 24 hours" },
  { value: 3, label: "Last 3 days" },
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Escape LIKE wildcards in user input before embedding in ilike patterns. */
export function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** UUID that matches nothing — used when a filter resolves to zero rows. */
const NOTHING_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Ids of organizations with account_status='active'.
 * organization_public_profiles only contains active accounts, and exposes
 * public fields only — safe for anonymous visitors.
 */
export async function getActiveOrgIds(db: Db): Promise<string[]> {
  const { data, error } = await db
    .from("organization_public_profiles")
    .select("id");
  if (error) throw new Error(`Failed to load organizations: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

const JOB_LIST_COLUMNS =
  "id, org_id, category_id, location_id, title, slug, description, responsibilities, " +
  "qualifications, skills, experience_min_years, experience_max_years, education_level, " +
  "employment_type, workplace, salary_min, salary_max, salary_period, salary_disclosed, " +
  "openings, is_fresh_graduate_ok, deadline, published_at, created_at";

/** Enrich raw job rows with their public org / category / location records. */
export async function enrichJobs(db: Db, rows: JobRow[]): Promise<PublicJob[]> {
  if (rows.length === 0) return [];
  const orgIds = [...new Set(rows.map((r) => r.org_id))];
  const catIds = [...new Set(rows.map((r) => r.category_id).filter((v): v is string => v !== null))];
  const locIds = [...new Set(rows.map((r) => r.location_id).filter((v): v is string => v !== null))];

  const [orgRes, catRes, locRes] = await Promise.all([
    db.from("organization_public_profiles").select("*").in("id", orgIds),
    catIds.length > 0
      ? db.from("job_categories").select("id, name, slug, icon").in("id", catIds)
      : Promise.resolve({ data: [], error: null }),
    locIds.length > 0
      ? db.from("locations").select("id, city, province, country").in("id", locIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (orgRes.error) throw new Error(`Failed to load employers: ${orgRes.error.message}`);
  if (catRes.error) throw new Error(`Failed to load categories: ${catRes.error.message}`);
  if (locRes.error) throw new Error(`Failed to load locations: ${locRes.error.message}`);

  const orgById = new Map<string, PublicOrg>(
    ((orgRes.data ?? []) as PublicOrg[]).map((o) => [o.id, o]),
  );
  const catById = new Map<string, PublicCategory>(
    ((catRes.data ?? []) as PublicCategory[]).map((c) => [c.id, c]),
  );
  const locById = new Map<string, PublicLocation>(
    ((locRes.data ?? []) as PublicLocation[]).map((l) => [l.id, l]),
  );

  return rows.map((r) => ({
    ...r,
    org: orgById.get(r.org_id) ?? null,
    category: r.category_id ? (catById.get(r.category_id) ?? null) : null,
    location: r.location_id ? (locById.get(r.location_id) ?? null) : null,
  }));
}

/**
 * Apply the live-job predicate (published + not expired + active org).
 * `any` is deliberate here: the filter is built dynamically and each chained
 * call returns a differently-shaped builder type.
 *
 * NOTE: this MUST stay synchronous and MUST never be awaited. PostgREST
 * filter builders are thenables, so `await`ing a builder (or an async
 * function that returns one) silently executes the query and resolves to
 * the result object — breaking any further chaining with
 * "d.order is not a function". Fetch async inputs (org ids) first, then
 * apply this synchronously.
 */
function applyLivePredicate(query: any, activeOrgIds: string[]): any {
  let q = query
    .eq("status", "published")
    .or("deadline.is.null,deadline.gt.now");
  q = activeOrgIds.length > 0 ? q.in("org_id", activeOrgIds) : q.eq("org_id", NOTHING_UUID);
  return q;
}

// ─── Job search ─────────────────────────────────────────────────────────────

/**
 * Server-side job search with working filters, sorting, and pagination.
 * All filtering happens in the database — never fetch-all-and-filter-client-side.
 */
export async function searchJobs(
  db: Db,
  filters: JobSearchFilters,
): Promise<JobSearchResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const perPage = Math.min(50, Math.max(1, Math.floor(filters.perPage ?? 12)));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const keyword = (filters.q ?? "").trim();

  async function run(useFullText: boolean) {
    // `any`: the filter chain is built dynamically; see applyLivePredicate.
    // Fetch async inputs BEFORE touching the builder, and never await the
    // builder itself (it is a thenable — awaiting executes the query).
    const activeOrgIds = await getActiveOrgIds(db);
    let query: any = db.from("jobs").select(JOB_LIST_COLUMNS, { count: "exact" });
    query = applyLivePredicate(query, activeOrgIds);

    if (keyword) {
      if (useFullText) {
        query = query.textSearch("search", keyword, {
          type: "websearch",
          config: "english",
        });
      } else {
        // Fallback when websearch syntax can't parse the input.
        const pattern = `%${escapeLike(keyword)}%`;
        query = query.or(
          `title.ilike.${pattern},description.ilike.${pattern}`,
        );
      }
    }

    if (filters.orgId) {
      query = query.eq("org_id", filters.orgId);
    } else if (filters.company?.trim()) {
      const { data: orgs, error } = await db
        .from("organization_public_profiles")
        .select("id")
        .ilike("name", `%${escapeLike(filters.company.trim())}%`);
      if (error) throw new Error(`Company search failed: ${error.message}`);
      const ids = (orgs ?? []).map((o) => o.id as string);
      query = ids.length > 0 ? query.in("org_id", ids) : query.eq("org_id", NOTHING_UUID);
    }

    if (filters.cityId) {
      query = query.eq("location_id", filters.cityId);
    }

    if (filters.province && PROVINCES.includes(filters.province)) {
      const { data: locs, error } = await db
        .from("locations")
        .select("id")
        .eq("province", filters.province);
      if (error) throw new Error(`Province lookup failed: ${error.message}`);
      const ids = (locs ?? []).map((l) => l.id as string);
      query = ids.length > 0 ? query.in("location_id", ids) : query.eq("location_id", NOTHING_UUID);
    }

    if (filters.categorySlug) {
      const { data: cat, error } = await db
        .from("job_categories")
        .select("id")
        .eq("slug", filters.categorySlug)
        .maybeSingle();
      if (error) throw new Error(`Category lookup failed: ${error.message}`);
      query = cat ? query.eq("category_id", cat.id) : query.eq("category_id", NOTHING_UUID);
    }

    if (filters.employmentType && EMPLOYMENT_TYPES.includes(filters.employmentType)) {
      query = query.eq("employment_type", filters.employmentType);
    }

    if (filters.workplace && filters.workplace in WORKPLACE_LABELS) {
      query = query.eq("workplace", filters.workplace);
    }

    if (filters.experienceLevel === "entry") {
      query = query.or("experience_min_years.is.null,experience_min_years.lte.1");
    } else if (filters.experienceLevel === "mid") {
      query = query.gte("experience_min_years", 2).lte("experience_min_years", 5);
    } else if (filters.experienceLevel === "senior") {
      query = query.gte("experience_min_years", 6);
    }

    if (filters.education) {
      query = query.ilike("education_level", `%${escapeLike(filters.education)}%`);
    }

    if (typeof filters.minSalary === "number" && Number.isFinite(filters.minSalary)) {
      // Disclosed salaries only: the top of the advertised range must meet the ask.
      query = query.eq("salary_disclosed", true).gte("salary_max", filters.minSalary);
    }

    if (filters.freshOnly) {
      query = query.eq("is_fresh_graduate_ok", true);
    }

    if (filters.postedWithinDays && filters.postedWithinDays > 0) {
      const since = new Date(Date.now() - filters.postedWithinDays * 86400_000).toISOString();
      // published_at may be null on older rows — fall back to created_at then.
      query = query.or(`published_at.gte.${since},and(published_at.is.null,created_at.gte.${since})`);
    }

    const sort = filters.sort ?? (keyword ? "relevance" : "newest");
    if (sort === "deadline") {
      query = query.order("deadline", { ascending: true, nullsFirst: false });
    } else if (sort === "salary") {
      // Disclosed salaries only, highest advertised maximum first.
      query = query.eq("salary_disclosed", true).order("salary_max", { ascending: false, nullsFirst: false });
    } else {
      // "relevance": full-text match already narrows the set; newest first is
      // the honest, RLS-safe ordering available without raw SQL ts_rank.
      query = query
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    }

    return query.range(from, to);
  }

  let res: { data: JobRow[] | null; count: number | null; error: unknown };
  try {
    res = await run(true);
  } catch {
    // websearch parsing can fail on odd input — retry with plain ILIKE.
    res = await run(false);
  }
  if (res.error) {
    const msg = res.error instanceof Error ? res.error.message : "unknown error";
    throw new Error(`Job search failed: ${msg}`);
  }

  const jobs = await enrichJobs(db, (res.data ?? []) as JobRow[]);
  const total = res.count ?? 0;
  return {
    jobs,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

// ─── Single job ─────────────────────────────────────────────────────────────

/** Live published job by slug, or null. Enforces the live-job rule. */
export async function getLiveJobBySlug(db: Db, slug: string): Promise<PublicJob | null> {
  const activeOrgIds = await getActiveOrgIds(db);
  // `any`: dynamic conditional chaining; see applyLivePredicate.
  let query: any = db
    .from("jobs")
    .select(JOB_LIST_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .or("deadline.is.null,deadline.gt.now");
  query =
    activeOrgIds.length > 0
      ? query.in("org_id", activeOrgIds)
      : query.eq("org_id", NOTHING_UUID);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to load job: ${error.message}`);
  if (!data) return null;
  const [job] = await enrichJobs(db, [data as JobRow]);
  return job ?? null;
}

/** Application questions preview for a live job (public via RLS). */
export async function getJobQuestions(db: Db, jobId: string): Promise<JobQuestion[]> {
  const { data, error } = await db
    .from("job_questions")
    .select("id, question, is_required, sort_order")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load questions: ${error.message}`);
  return (data ?? []) as JobQuestion[];
}

// ─── Reference data ─────────────────────────────────────────────────────────

export async function getCategories(db: Db): Promise<PublicCategory[]> {
  const { data, error } = await db
    .from("job_categories")
    .select("id, name, slug, icon")
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return (data ?? []) as PublicCategory[];
}

export async function getLocations(db: Db): Promise<PublicLocation[]> {
  const { data, error } = await db
    .from("locations")
    .select("id, city, province, country")
    .order("city", { ascending: true });
  if (error) throw new Error(`Failed to load locations: ${error.message}`);
  return (data ?? []) as PublicLocation[];
}

/** Verified, active organizations (public fields only). */
export async function getVerifiedOrgs(db: Db, limit = 50): Promise<PublicOrg[]> {
  const { data, error } = await db
    .from("organization_public_profiles")
    .select("*")
    .eq("verification_status", "verified")
    .order("name", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to load employers: ${error.message}`);
  return (data ?? []) as PublicOrg[];
}

/** Verified org by slug, or null when missing/unverified. */
export async function getVerifiedOrgBySlug(db: Db, slug: string): Promise<PublicOrg | null> {
  const { data, error } = await db
    .from("organization_public_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("verification_status", "verified")
    .maybeSingle();
  if (error) throw new Error(`Failed to load employer: ${error.message}`);
  return (data as PublicOrg | null) ?? null;
}

// ─── Live counts (single lightweight query, aggregated server-side) ──────────

export interface LiveJobCounts {
  total: number;
  freshGraduate: number;
  byCategory: Map<string, number>;
  byLocation: Map<string, number>;
  byEmploymentType: Map<string, number>;
  byWorkplace: Map<string, number>;
  byOrg: Map<string, number>;
}

/** One minimal-column query over live jobs; counts derived server-side. */
export async function getLiveJobCounts(db: Db): Promise<LiveJobCounts> {
  // Never await the builder itself (it is a thenable — awaiting executes it).
  const activeOrgIds = await getActiveOrgIds(db);
  let query = applyLivePredicate(
    db
      .from("jobs")
      .select("id, org_id, category_id, location_id, employment_type, workplace, is_fresh_graduate_ok", {
        count: "exact",
      }),
    activeOrgIds,
  );

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to count jobs: ${error.message}`);

  const rows = (data ?? []) as {
    org_id: string;
    category_id: string | null;
    location_id: string | null;
    employment_type: string;
    workplace: string;
    is_fresh_graduate_ok: boolean;
  }[];

  const byCategory = new Map<string, number>();
  const byLocation = new Map<string, number>();
  const byEmploymentType = new Map<string, number>();
  const byWorkplace = new Map<string, number>();
  const byOrg = new Map<string, number>();
  let freshGraduate = 0;

  for (const r of rows) {
    if (r.category_id) byCategory.set(r.category_id, (byCategory.get(r.category_id) ?? 0) + 1);
    if (r.location_id) byLocation.set(r.location_id, (byLocation.get(r.location_id) ?? 0) + 1);
    byEmploymentType.set(r.employment_type, (byEmploymentType.get(r.employment_type) ?? 0) + 1);
    byWorkplace.set(r.workplace, (byWorkplace.get(r.workplace) ?? 0) + 1);
    byOrg.set(r.org_id, (byOrg.get(r.org_id) ?? 0) + 1);
    if (r.is_fresh_graduate_ok) freshGraduate += 1;
  }

  return { total: count ?? rows.length, freshGraduate, byCategory, byLocation, byEmploymentType, byWorkplace, byOrg };
}

// ─── Convenience: request client + counts for a page ────────────────────────

/** Request-bound client for public pages (RLS applies). */
export async function publicClient(): Promise<Db> {
  return createClient();
}
