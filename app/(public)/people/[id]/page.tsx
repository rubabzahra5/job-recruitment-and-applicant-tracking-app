import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSessionUser } from "@/lib/auth";
import { listAuthorPosts } from "@/lib/feed";
import type { FeedAuthorView } from "@/lib/feed-shared";
import { formatDateOnlyKarachi } from "@/lib/format";
import { isSuperAdmin } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostList } from "../../_components/PostList";

type Params = { id: string };

/**
 * Public candidate profile page — OPT-IN (migration 0015).
 *
 * A candidate's page is visible only when profiles.profile_public is true.
 * The owner and super_admins can always view it. Everyone else gets a
 * friendly "isn't public" page that leaks no profile data (not even the
 * candidate's name). Fails soft before the migration runs: the
 * profile_public column doesn't exist yet, so every profile reads as
 * private — exactly the safe default.
 */

interface PortfolioLink {
  label: string | null;
  url: string;
}
interface LanguageEntry {
  language: string;
  proficiency: string;
}

/** Parse candidate_profiles.portfolio_links (same shape as the portal's). */
function parsePortfolio(raw: unknown): { links: PortfolioLink[]; languages: LanguageEntry[] } {
  const links: PortfolioLink[] = [];
  const languages: LanguageEntry[] = [];
  if (!Array.isArray(raw)) return { links, languages };
  for (const item of raw) {
    if (typeof item === "string") {
      if (item.trim()) links.push({ label: null, url: item.trim() });
      continue;
    }
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (rec.kind === "language" && typeof rec.language === "string") {
      languages.push({
        language: rec.language,
        proficiency: typeof rec.proficiency === "string" ? rec.proficiency : "Conversational",
      });
    } else if (typeof rec.url === "string" && rec.url.trim()) {
      links.push({
        label: typeof rec.label === "string" ? rec.label : null,
        url: rec.url.trim(),
      });
    }
  }
  return { links, languages };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("profile_public")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.profile_public !== true) return { title: "Profile" };
  const { data: cp } = await admin
    .from("candidate_profiles")
    .select("full_name, headline")
    .eq("user_id", id)
    .maybeSingle();
  if (!cp) return { title: "Profile" };
  return {
    title: `${cp.full_name as string} — Candidate Profile`,
    description: (cp.headline as string | null) ?? `Public profile of ${cp.full_name as string} on TalentBridge.`,
  };
}

function NotPublicPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <EmptyState
        title="This profile isn't public"
        description="This candidate hasn't switched on their public profile. Candidates choose what to share — you can still browse open jobs and verified companies on TalentBridge."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/jobs"
              className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              Browse jobs
            </Link>
            <Link
              href="/companies"
              className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Browse companies
            </Link>
          </div>
        }
      />
    </main>
  );
}

export default async function PublicPersonPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) notFound();

  const viewer = await getSessionUser();
  const admin = createAdminClient();

  // profile_public may not exist before migration 0015 — then the select
  // errors and the profile correctly reads as private (fail soft).
  const { data: account, error: accountError } = await admin
    .from("profiles")
    .select("id, display_name, email, profile_public")
    .eq("id", id)
    .maybeSingle();
  if (accountError) {
    // Column missing pre-migration: fall back to a read without the flag.
    const { data: basic } = await admin
      .from("profiles")
      .select("id, display_name, email")
      .eq("id", id)
      .maybeSingle();
    if (!basic) notFound();
    const isOwnerBasic = viewer?.id === id;
    const adminBasic = viewer ? await isSuperAdmin(viewer.id).catch(() => false) : false;
    if (!isOwnerBasic && !adminBasic) return <NotPublicPage />;
    // Owner/admin before the migration: still show the profile data below,
    // with profilePublic effectively false.
    return renderProfile(id, viewer, false, isOwnerBasic, adminBasic);
  }
  if (!account) notFound();

  const profilePublic = account.profile_public === true;
  const isOwner = viewer?.id === id;
  const viewerIsAdmin = viewer ? await isSuperAdmin(viewer.id).catch(() => false) : false;
  if (!profilePublic && !isOwner && !viewerIsAdmin) return <NotPublicPage />;

  return renderProfile(id, viewer, profilePublic, isOwner, viewerIsAdmin);
}

async function renderProfile(
  id: string,
  viewer: { id: string; email: string | null } | null,
  profilePublic: boolean,
  isOwner: boolean,
  viewerIsAdmin: boolean,
) {
  const admin = createAdminClient();
  const { data: cp } = await admin
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();
  if (!cp) return <NotPublicPage />;

  const profileId = cp.id as string;
  const [
    { data: education },
    { data: experience },
    { data: skills },
    { data: certifications },
    { data: cvDocs },
  ] = await Promise.all([
    admin.from("candidate_education").select("*").eq("profile_id", profileId).order("start_year", { ascending: false, nullsFirst: false }),
    admin.from("candidate_experience").select("*").eq("profile_id", profileId).order("start_date", { ascending: false }),
    admin.from("candidate_skills").select("*").eq("profile_id", profileId).order("skill"),
    admin.from("candidate_certifications").select("*").eq("profile_id", profileId).order("issued_date", { ascending: false, nullsFirst: false }),
    admin.from("candidate_documents").select("id").eq("profile_id", profileId).eq("kind", "cv").eq("is_current_cv", true).limit(1),
  ]);

  const portfolio = parsePortfolio(cp.portfolio_links);
  const hasCv = (cvDocs?.length ?? 0) > 0;
  const fullName = cp.full_name as string;
  const location = [cp.city, cp.province].filter(Boolean).join(", ");

  // The candidate's feed posts (fail-soft: section hides pre-migration).
  const posts = await listAuthorPosts(viewer?.id ?? null, id);

  // Viewer context for interactive post cards (likes/comments) when signed in.
  let postViewer: ({ id: string; isSuperAdmin: boolean; author: FeedAuthorView }) | null = null;
  if (viewer) {
    const [{ data: vAccount }, { data: vCandidate }] = await Promise.all([
      admin.from("profiles").select("display_name, email, profile_public").eq("id", viewer.id).maybeSingle(),
      admin.from("candidate_profiles").select("full_name, headline").eq("user_id", viewer.id).maybeSingle(),
    ]);
    postViewer = {
      id: viewer.id,
      isSuperAdmin: viewerIsAdmin,
      author: {
        id: viewer.id,
        name:
          (vCandidate?.full_name as string | undefined) ??
          (vAccount?.display_name as string | null) ??
          (vAccount?.email as string | null)?.split("@")[0] ??
          "Member",
        headline: (vCandidate?.headline as string | null) ?? null,
        isCandidate: Boolean(vCandidate),
        profilePublic: vAccount?.profile_public === true,
      },
    };
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {isOwner && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <p>
            {profilePublic
              ? "This is your public profile — this is what visitors see."
              : "Only you can see this page right now — your public profile is switched off."}
          </p>
          <Link href="/candidate/profile" className="font-semibold text-brand-700 hover:underline">
            Manage in my portal →
          </Link>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-5">
            <Avatar name={fullName} size="lg" className="h-20 w-20 text-2xl" />
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
                {fullName}
              </h1>
              {cp.headline && <p className="mt-1 text-slate-600">{cp.headline as string}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {location && <Badge tone="neutral">{location}</Badge>}
                {cp.availability && <Badge tone="info">{cp.availability as string}</Badge>}
                {hasCv && <Badge tone="success">CV available</Badge>}
              </div>
            </div>
          </div>
          {cp.summary && (
            <div className="mt-6">
              <h2 className="text-lg font-bold text-slate-900">About</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{cp.summary as string}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {(skills ?? []).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {(skills ?? []).map((s) => (
                <Badge key={s.id as string} tone="neutral">
                  {s.skill as string}
                  {s.years ? ` · ${s.years as number} yrs` : ""}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(experience ?? []).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Experience</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {(experience ?? []).map((e) => (
                <li key={e.id as string}>
                  <p className="font-semibold text-slate-900">{e.title as string}</p>
                  <p className="text-sm text-slate-600">{e.employer as string}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateOnlyKarachi(e.start_date as string)} —{" "}
                    {e.is_current ? "Present" : formatDateOnlyKarachi(e.end_date as string | null)}
                  </p>
                  {e.description && (
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{e.description as string}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(education ?? []).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Education</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(education ?? []).map((ed) => (
                <li key={ed.id as string}>
                  <p className="font-semibold text-slate-900">
                    {ed.degree as string}
                    {ed.field ? `, ${ed.field as string}` : ""}
                  </p>
                  <p className="text-sm text-slate-600">{ed.institution as string}</p>
                  <p className="text-xs text-slate-500">
                    {[ed.start_year, ed.is_current ? "Present" : ed.end_year].filter(Boolean).join(" – ")}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(certifications ?? []).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(certifications ?? []).map((c) => (
                <li key={c.id as string} className="text-sm">
                  <span className="font-medium text-slate-900">{c.name as string}</span>
                  {c.issuer ? <span className="text-slate-600"> — {c.issuer as string}</span> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(portfolio.links.length > 0 || portfolio.languages.length > 0) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Links &amp; languages</CardTitle>
          </CardHeader>
          <CardContent>
            {portfolio.links.length > 0 && (
              <ul className="space-y-1.5">
                {portfolio.links.map((l, i) => (
                  <li key={i}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      {l.label || l.url.replace(/^https?:\/\//, "")} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {portfolio.languages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {portfolio.languages.map((l, i) => (
                  <Badge key={i} tone="neutral">
                    {l.language} · {l.proficiency}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {posts.ready && posts.data.length > 0 && (
        <section className="mt-10" aria-label={`Posts by ${fullName}`}>
          <h2 className="text-xl font-bold text-slate-900">Posts</h2>
          <div className="mt-4">
            <PostList initialPosts={posts.data} viewer={postViewer} />
          </div>
        </section>
      )}
    </main>
  );
}
