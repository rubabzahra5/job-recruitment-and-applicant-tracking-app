import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { FeedRead } from "@/lib/feed";

/**
 * Follow data layer (migration 0016: follows).
 *
 * Same FAIL-SOFT CONTRACT as lib/feed.ts: reads return `{ ready: false }`
 * instead of throwing when the follows table is unavailable (i.e. before
 * migration 0016 has been run), and pages simply hide the follow UI.
 * Reads use the service-role client after the caller established the
 * session; writes live in app/(public)/feed/_actions.ts (toggleFollow),
 * with RLS in 0016 as the backstop for direct API access.
 */

export interface FollowState {
  /** How many people follow this target. */
  followerCount: number;
  /**
   * How many people/companies this target follows. Only meaningful for
   * person profiles; null for companies (orgs don't follow anyone).
   */
  followingCount: number | null;
  /** True when the viewer already follows this target. */
  isFollowing: boolean;
}

type Db = ReturnType<typeof createAdminClient>;

async function countFollows(
  db: Db,
  column: "follow_profile_id" | "follow_org_id" | "follower_id",
  value: string,
): Promise<number> {
  const { count, error } = await db
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

async function viewerFollows(
  db: Db,
  viewerId: string | null,
  column: "follow_profile_id" | "follow_org_id",
  value: string,
): Promise<boolean> {
  if (!viewerId) return false;
  const { data, error } = await db
    .from("follows")
    .select("id")
    .eq("follower_id", viewerId)
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Follow state for a person's public profile page (/people/[id]). */
export async function getProfileFollowState(
  viewerId: string | null,
  profileId: string,
): Promise<FeedRead<FollowState>> {
  const db = createAdminClient();
  try {
    const [followerCount, followingCount, isFollowing] = await Promise.all([
      countFollows(db, "follow_profile_id", profileId),
      countFollows(db, "follower_id", profileId),
      viewerFollows(db, viewerId, "follow_profile_id", profileId),
    ]);
    return { ready: true, data: { followerCount, followingCount, isFollowing } };
  } catch (e) {
    console.error("[follows] getProfileFollowState failed (follows not set up yet?):", e);
    return { ready: false };
  }
}

/** Follow state for a company page (/companies/[slug]). */
export async function getOrgFollowState(
  viewerId: string | null,
  orgId: string,
): Promise<FeedRead<FollowState>> {
  const db = createAdminClient();
  try {
    const [followerCount, isFollowing] = await Promise.all([
      countFollows(db, "follow_org_id", orgId),
      viewerFollows(db, viewerId, "follow_org_id", orgId),
    ]);
    return {
      ready: true,
      data: { followerCount, followingCount: null, isFollowing },
    };
  } catch (e) {
    console.error("[follows] getOrgFollowState failed (follows not set up yet?):", e);
    return { ready: false };
  }
}
