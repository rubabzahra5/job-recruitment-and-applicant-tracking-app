import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSessionUser } from "@/lib/auth";
import { listFeedPosts } from "@/lib/feed";
import type { FeedAuthorView } from "@/lib/feed-shared";
import { getUserOrgRole, isSuperAdmin } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { FeedClient, type FeedJobOption, type FeedOrgOption } from "./_components/FeedClient";

export const metadata: Metadata = {
  title: "Community Feed",
  description:
    "Updates from candidates and companies across Pakistan — career milestones, hiring announcements and shared jobs on TalentBridge.",
};

/**
 * The TalentBridge community feed (LinkedIn-style).
 *
 * Logged-in only: signed-out visitors are redirected to /login (the
 * middleware also guards /feed). Everyone signed in can post — candidates
 * as themselves, employers as themselves or as their company.
 *
 * Fails soft before migration 0015 runs: a friendly "being set up" state
 * instead of an error page.
 */
export default async function FeedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/feed");

  const admin = createAdminClient();

  const [{ data: account }, { data: candidate }, { data: memberships }, superAdmin] =
    await Promise.all([
      admin.from("profiles").select("display_name, email, profile_public").eq("id", user.id).maybeSingle(),
      admin.from("candidate_profiles").select("full_name, headline").eq("user_id", user.id).maybeSingle(),
      admin
        .from("organization_memberships")
        .select("org_id, organizations ( id, name )")
        .eq("user_id", user.id)
        .eq("is_active", true),
      isSuperAdmin(user.id),
    ]);

  const author: FeedAuthorView = {
    id: user.id,
    name:
      (candidate?.full_name as string | undefined) ??
      (account?.display_name as string | null) ??
      (account?.email as string | null)?.split("@")[0] ??
      user.email?.split("@")[0] ??
      "Member",
    headline: (candidate?.headline as string | null) ?? null,
    isCandidate: Boolean(candidate),
    profilePublic: account?.profile_public === true,
  };

  // Companies the viewer may post as: active membership + an org role
  // (the createPost action re-checks with requireOrgMembership).
  const orgOptions: FeedOrgOption[] = [];
  const jobsByOrg: Record<string, FeedJobOption[]> = {};
  for (const m of memberships ?? []) {
    const org = m.organizations as unknown as { id: string; name: string } | null;
    if (!org) continue;
    const role = await getUserOrgRole(user.id, org.id).catch(() => null);
    if (!role) continue;
    orgOptions.push({ id: org.id, name: org.name });
    const { data: jobs } = await admin
      .from("jobs")
      .select("id, title")
      .eq("org_id", org.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(20);
    jobsByOrg[org.id] = (jobs ?? []).map((j) => ({ id: j.id as string, title: j.title as string }));
  }

  const feed = await listFeedPosts(user.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
        Community feed
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Updates from candidates and companies across Pakistan — career milestones,
        hiring announcements and shared jobs.
      </p>

      <div className="mt-6">
        {!feed.ready ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                title="The community feed is being set up"
                description="We're finishing the last setup steps for the TalentBridge community feed. Please check back shortly — posting, likes and comments will be available here."
              />
            </CardContent>
          </Card>
        ) : (
          <FeedClient
            initialPosts={feed.data.posts}
            initialCursor={feed.data.nextCursor}
            viewer={{ id: user.id, isSuperAdmin: superAdmin, author }}
            orgOptions={orgOptions}
            jobsByOrg={jobsByOrg}
          />
        )}
      </div>
    </main>
  );
}
