import type { Metadata } from "next";
import Link from "next/link";
import {
  requireCandidate,
  getOrCreateCandidateProfile,
} from "@/app/(candidate)/_lib/candidate-guard";
import { computeProfileCompletion } from "@/app/(candidate)/_lib/profile-completion";
import { stageLabel, StageBadge } from "@/app/(candidate)/_components/StageBadge";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateKarachi, timeAgo } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Candidate Dashboard" };

interface ApplicationRow {
  id: string;
  stage: string;
  submitted_at: string;
  withdrawn_at: string | null;
  job: { title: string; org: { name: string } | null } | null;
}

interface InterviewRow {
  id: string;
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  format: string;
  venue: string | null;
  meeting_link: string | null;
  status: string;
  job: { title: string } | null;
}

interface HistoryRow {
  id: string;
  from_stage: string | null;
  to_stage: string;
  created_at: string;
  application: { id: string; job: { title: string } | null } | null;
}

export default async function CandidateDashboardPage() {
  const user = await requireCandidate();
  const admin = createAdminClient();

  const profile = await getOrCreateCandidateProfile(user.id);

  const [
    { count: educationCount },
    { count: experienceCount },
    { count: skillsCount },
    { data: cvDocs },
    { data: applications },
    { count: savedCount },
    { count: unreadCount },
  ] = await Promise.all([
    admin.from("candidate_education").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
    admin.from("candidate_experience").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
    admin.from("candidate_skills").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
    admin.from("candidate_documents").select("id").eq("profile_id", profile.id).eq("kind", "cv").eq("is_current_cv", true).limit(1),
    admin.from("applications").select("id,stage,submitted_at,withdrawn_at,job:jobs(title,org:organizations(name))").eq("user_id", user.id).order("submitted_at", { ascending: false }),
    admin.from("saved_jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
  ]);

  const completion = computeProfileCompletion({
    profile,
    educationCount: educationCount ?? 0,
    experienceCount: experienceCount ?? 0,
    skillsCount: skillsCount ?? 0,
    hasCurrentCv: (cvDocs?.length ?? 0) > 0,
  });

  const apps = ((applications ?? []) as unknown as ApplicationRow[]);
  const activeApps = apps.filter((a) => !a.withdrawn_at);
  const byStage = new Map<string, number>();
  for (const a of activeApps) byStage.set(a.stage, (byStage.get(a.stage) ?? 0) + 1);

  const appIds = apps.map((a) => a.id);
  let interviews: InterviewRow[] = [];
  let activity: HistoryRow[] = [];
  if (appIds.length > 0) {
    const [{ data: iv }, { data: hist }] = await Promise.all([
      admin
        .from("interviews")
        .select("id,application_id,scheduled_at,duration_minutes,format,venue,meeting_link,status,job:jobs(title)")
        .in("application_id", appIds)
        .gte("scheduled_at", new Date().toISOString())
        .in("status", ["scheduled", "rescheduled"])
        .order("scheduled_at", { ascending: true })
        .limit(5),
      admin
        .from("application_status_history")
        .select("id,from_stage,to_stage,created_at,application:applications!inner(id,job:jobs(title))")
        .in("application_id", appIds)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    interviews = ((iv ?? []) as unknown as InterviewRow[]);
    activity = ((hist ?? []) as unknown as HistoryRow[]);
  }

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track your applications, interviews and profile strength.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/jobs">
            <Button variant="outline">Browse jobs</Button>
          </Link>
          <Link href="/candidate/profile">
            <Button variant="primary">Complete profile</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Profile completion"
          value={`${completion.percent}%`}
          hint={completion.missing.length > 0 ? `Missing: ${completion.missing.slice(0, 2).join(", ")}` : "All sections complete"}
        />
        <Stat label="Active applications" value={activeApps.length} hint="Withdrawn applications excluded" />
        <Stat label="Saved jobs" value={savedCount ?? 0} />
        <Stat label="Unread notifications" value={unreadCount ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications by stage</CardTitle>
          </CardHeader>
          <CardContent>
            {activeApps.length === 0 ? (
              <EmptyState
                title="No applications yet"
                description="Browse open roles and submit your first application."
                action={
                  <Link href="/jobs">
                    <Button variant="primary" size="sm">Browse jobs</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...byStage.entries()].map(([stage, count]) => (
                  <li key={stage} className="flex items-center justify-between py-2.5">
                    <StageBadge stage={stage} />
                    <span className="text-sm font-semibold text-slate-700">{count}</span>
                  </li>
                ))}
              </ul>
            )}
            {activeApps.length > 0 && (
              <div className="mt-4">
                <Link href="/candidate/applications" className="text-sm font-medium text-brand-700 hover:underline">
                  View all applications →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming interviews</CardTitle>
          </CardHeader>
          <CardContent>
            {interviews.length === 0 ? (
              <EmptyState
                title="No upcoming interviews"
                description="Scheduled interviews for your applications will appear here."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {interviews.map((iv) => (
                  <li key={iv.id} className="py-3">
                    <p className="text-sm font-medium text-slate-900">
                      {iv.job?.title ?? "Interview"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDateKarachi(iv.scheduled_at)} · {iv.duration_minutes} min ·{" "}
                      {iv.format.replace("_", " ")}
                      {iv.venue ? ` · ${iv.venue}` : ""}
                    </p>
                    {iv.meeting_link && (
                      <a
                        href={iv.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-block text-xs font-medium text-brand-700 hover:underline"
                      >
                        Join meeting link
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent application activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Status changes on your applications will show up here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {activity.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {h.application?.job?.title ?? "Application"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {h.from_stage ? `${stageLabel(h.from_stage)} → ` : ""}
                      {stageLabel(h.to_stage)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(h.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
