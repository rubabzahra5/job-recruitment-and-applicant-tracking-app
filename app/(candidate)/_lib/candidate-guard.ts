import "server-only";

import { requireSessionUser, type SessionUser } from "@/lib/auth";
import { AuthorizationError, isCandidate } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Candidate-portal authorization gate.
 *
 * Every candidate page and server action must call `requireCandidate()`:
 * - the user must be signed in (requireSessionUser)
 * - the user must hold the platform-wide `candidate` role, read from the
 *   `user_roles` table via lib/rbac.ts (never from client input/cookies)
 *
 * A user holding only org roles (recruiter, org_admin, …) is rejected here,
 * and candidate-role users are rejected from org portals by those portals'
 * own guards. Dual-role users pass the guard of each portal they hold a
 * role for.
 */
export async function requireCandidate(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!(await isCandidate(user.id))) {
    throw new AuthorizationError("Candidate access required.");
  }
  return user;
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  full_name: string;
  headline: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  expected_salary: number | null;
  notice_period_days: number | null;
  availability: string | null;
  summary: string | null;
  portfolio_links: unknown;
  is_searchable: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationRow {
  id: string;
  city: string;
  province: string;
}

/**
 * A candidate's own profile row (user_id = auth.uid()), or null when the
 * candidate has not created one yet. Reads with the service-role client —
 * callers must have passed requireCandidate() first.
 */
export async function getCandidateProfile(
  userId: string,
): Promise<CandidateProfile | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load candidate profile: ${error.message}`);
  return (data ?? null) as CandidateProfile | null;
}

/** Load the profile, creating a minimal one on first use. */
export async function getOrCreateCandidateProfile(
  userId: string,
): Promise<CandidateProfile> {
  const existing = await getCandidateProfile(userId);
  if (existing) return existing;
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("profiles")
    .select("display_name,email")
    .eq("id", userId)
    .maybeSingle();
  const fallbackName =
    (account?.display_name as string | null) ??
    (account?.email as string | null)?.split("@")[0] ??
    "Candidate";
  const { data, error } = await admin
    .from("candidate_profiles")
    .insert({ user_id: userId, full_name: fallbackName })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to create candidate profile: ${error?.message ?? "unknown"}`);
  }
  return data as CandidateProfile;
}

/** All reference locations (city + province), for profile/job-alert selects. */
export async function getLocations(): Promise<LocationRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("locations")
    .select("id,city,province")
    .order("province", { ascending: true })
    .order("city", { ascending: true });
  if (error) throw new Error(`Failed to load locations: ${error.message}`);
  return (data ?? []) as LocationRow[];
}

/**
 * `candidate_documents.storage_path` is stored with the bucket prefix
 * ("cvs/{userId}/{uuid}.pdf"). The Storage API wants the object name without
 * it ("{userId}/{uuid}.pdf").
 */
export function storageObjectName(storagePath: string): string {
  return storagePath.replace(/^cvs\//, "");
}

/** Short-lived download URL for a CV the candidate owns. */
export async function createCvSignedUrl(
  storagePath: string,
  expiresInSeconds = 120,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("cvs")
    .createSignedUrl(storageObjectName(storagePath), expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create download link: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}
