import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateKarachi, formatDateOnlyKarachi } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  getOrgContext,
  getAssignedApplicationIds,
  NoOrganizationError,
} from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { InterviewForm } from "../../_components/InterviewForm";
import { InterviewActions, FeedbackForm } from "../../_components/InterviewActions";
import {
  scheduleInterview,
  rescheduleInterview,
  cancelInterview,
  markAttendance,
  submitFeedback,
  getInterviewerOptions,
} from "./actions";

export const metadata: Metadata = { title: "Interviews" };

interface SearchParams {
  org?: string;
  application?: string;
  schedule?: string;
  status?: string;
}

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  scheduled: "info",
  rescheduled: "warning",
  completed: "success",
  cancelled: "neutral",
  no_show: "danger",
};

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  const admin = createAdminClient();
  const orgParam = `org=${encodeURIComponent(ctx.orgId)}`;

  const assignedIds = ctx.role === "hiring_manager" ? await getAssignedApplicationIds(ctx.user.id) : null;

  let query = admin
    .from("interviews")
    .select(
      "id,application_id,scheduled_at,duration_minutes,timezone,format,venue,meeting_link,instructions,status,applications!inner(id,org_id,stage,user_id,jobs(title))",
    )
    .eq("org_id", ctx.orgId)
    .order("scheduled_at", { ascending: false })
    .limit(200);
  if (sp.status) query = query.eq("status", sp.status);
  const { data: interviews } = await query;

  let list = (interviews ?? []) as Array<Record<string, unknown>>;
  if (assignedIds) list = list.filter((i) => assignedIds.has(i.application_id as string));

  // Candidate names (no FK between applications and candidate_profiles — separate query).
  const candUserIds = [...new Set(list.map((i) => ((i.applications as { user_id: string } | null)?.user_id)).filter((x): x is string => !!x))];
  const { data: candProfiles } = candUserIds.length > 0
    ? await admin.from("candidate_profiles").select("user_id,full_name").in("user_id", candUserIds)
    : { data: [] as { user_id: string; full_name: string }[] };
  const candNameByUser = new Map((candProfiles ?? []).map((c) => [c.user_id as string, c.full_name as string]));

  const interviewIds = list.map((i) => i.id as string);
  const [{ data: participants }, { data: feedback }] = interviewIds.length > 0
    ? await Promise.all([
        admin.from("interview_participants").select("interview_id,name,email,role_text").in("interview_id", interviewIds),
        admin.from("interview_feedback").select("interview_id,reviewer_user_id,rating,recommendation,strengths,concerns").in("interview_id", interviewIds),
      ])
    : [{ data: [] }, { data: [] }];
  const partsByInterview = new Map<string, { name: string; email: string; role: string | null }[]>();
  for (const p of (participants ?? []) as Array<{ interview_id: string; name: string; email: string; role_text: string | null }>) {
    const arr = partsByInterview.get(p.interview_id) ?? [];
    arr.push({ name: p.name, email: p.email, role: p.role_text });
    partsByInterview.set(p.interview_id, arr);
  }
  const feedbackByInterview = new Map<string, Array<{ reviewer: string; rating: number; recommendation: string }>>();
  const reviewerIds = [...new Set(((feedback ?? []) as Array<{ reviewer_user_id: string }>).map((f) => f.reviewer_user_id))];
  const { data: reviewers } = reviewerIds.length > 0
    ? await admin.from("profiles").select("id,display_name,email").in("id", reviewerIds)
    : { data: [] as { id: string; display_name: string | null; email: string }[] };
  const reviewerName = new Map((reviewers ?? []).map((r) => [r.id as string, (r.display_name as string | null) ?? (r.email as string)]));
  for (const f of (feedback ?? []) as Array<{ interview_id: string; reviewer_user_id: string; rating: number; recommendation: string }>) {
    const arr = feedbackByInterview.get(f.interview_id) ?? [];
    arr.push({ reviewer: reviewerName.get(f.reviewer_user_id) ?? "Reviewer", rating: f.rating, recommendation: f.recommendation });
    feedbackByInterview.set(f.interview_id, arr);
  }
  const myFeedbackByInterview = new Map<string, { rating: number; strengths: string | null; concerns: string | null; recommendation: string }>();
  for (const f of (feedback ?? []) as Array<{ interview_id: string; reviewer_user_id: string; rating: number; strengths: string | null; concerns: string | null; recommendation: string }>) {
    if (f.reviewer_user_id === ctx.user.id) {
      myFeedbackByInterview.set(f.interview_id, { rating: f.rating, strengths: f.strengths, concerns: f.concerns, recommendation: f.recommendation });
    }
  }

  const showForm = sp.schedule === "1" || !!sp.application;
  let schedulableApps: { id: string; label: string }[] = [];
  let interviewerOptions: { userId: string; name: string; role: string | null; title: string | null }[] = [];
  if (showForm) {
    const { data: apps } = await admin
      .from("applications")
      .select("id,stage,user_id,jobs(title)")
      .eq("org_id", ctx.orgId)
      .order("submitted_at", { ascending: false })
      .limit(500);
    const appRows = ((apps ?? []) as Array<Record<string, unknown>>).filter(
      (a) => !assignedIds || assignedIds.has(a.id as string),
    );
    const schedUserIds = [...new Set(appRows.map((a) => a.user_id as string))];
    const { data: schedProfiles } = schedUserIds.length > 0
      ? await admin.from("candidate_profiles").select("user_id,full_name").in("user_id", schedUserIds)
      : { data: [] as { user_id: string; full_name: string }[] };
    const schedNameByUser = new Map((schedProfiles ?? []).map((c) => [c.user_id as string, c.full_name as string]));
    schedulableApps = appRows.map((a) => ({
      id: a.id as string,
      label: `${schedNameByUser.get(a.user_id as string) ?? "Candidate"} — ${((a.jobs as { title: string } | null)?.title) ?? "—"} (${a.stage as string})`,
    }));
    if (sp.application && !schedulableApps.some((a) => a.id === sp.application)) {
      schedulableApps = [];
    }
    interviewerOptions = await getInterviewerOptions(ctx.orgId);
  }

  const upcoming = list.filter((i) => ["scheduled", "rescheduled"].includes(i.status as string));
  const past = list.filter((i) => !["scheduled", "rescheduled"].includes(i.status as string));

  const renderInterview = (iv: Record<string, unknown>) => {
    const id = iv.id as string;
    const app = iv.applications as { stage: string; user_id: string; jobs: { title: string } | null } | null;
    const candidateName = (app?.user_id && candNameByUser.get(app.user_id)) ?? "Candidate";
    const parts = partsByInterview.get(id) ?? [];
    const fb = feedbackByInterview.get(id) ?? [];
    return (
      <Card key={id}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {candidateName} — {app?.jobs?.title ?? "—"}
            </CardTitle>
            <Badge tone={STATUS_TONE[iv.status as string] ?? "neutral"}>{(iv.status as string).replace("_", " ")}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">{formatDateKarachi(iv.scheduled_at as string)}</span>
            <span className="text-slate-500"> (Asia/Karachi) · {iv.duration_minutes as number} min · {(iv.format as string).replace("_", " ")}</span>
          </p>
          <p className="text-slate-600">
            Interviewers: {parts.map((p) => p.name).join(", ") || "—"}
          </p>
          {iv.venue ? <p className="text-slate-600">Venue: {iv.venue as string}</p> : null}
          {iv.meeting_link ? (
            <p>
              Meeting link:{" "}
              <a href={iv.meeting_link as string} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                {iv.meeting_link as string}
              </a>
            </p>
          ) : null}
          {iv.instructions ? <p className="whitespace-pre-wrap text-slate-600">{iv.instructions as string}</p> : null}
          {fb.length > 0 && (
            <div className="rounded bg-slate-50 p-2 text-xs text-slate-600">
              Feedback: {fb.map((f, i) => (
                <span key={i} className="mr-3">{f.reviewer}: {f.rating}/5 ({f.recommendation.replace("_", " ")})</span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-4 pt-1">
            <InterviewActions
              interviewId={id}
              status={iv.status as string}
              rescheduleAction={rescheduleInterview.bind(null, ctx.orgId)}
              cancelAction={cancelInterview.bind(null, ctx.orgId)}
              attendanceAction={markAttendance.bind(null, ctx.orgId)}
            />
            <Link href={`/employer/applications/${iv.application_id as string}?${orgParam}`} className="text-sm text-brand-700 hover:underline self-center">
              Open application
            </Link>
          </div>
          {["completed"].includes(iv.status as string) && (
            <FeedbackForm
              interviewId={id}
              existing={myFeedbackByInterview.get(id) ?? null}
              submitAction={submitFeedback.bind(null, ctx.orgId)}
            />
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Interviews</h1>
        {!showForm && (
          <Link href={`/employer/interviews?${orgParam}&schedule=1`}>
            <Button>Schedule interview</Button>
          </Link>
        )}
      </div>

      {showForm && (
        <div className="mt-4">
          <InterviewForm
            applications={schedulableApps}
            interviewers={interviewerOptions}
            preselectedApplicationId={sp.application}
            scheduleAction={scheduleInterview.bind(null, ctx.orgId)}
            cancelHref={`/employer/interviews?${orgParam}`}
          />
        </div>
      )}

      <form method="get" className="mt-4 flex gap-2">
        <input type="hidden" name="org" value={ctx.orgId} />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Filter by status" className="h-10 rounded-md border border-slate-300 px-2 text-sm">
          <option value="">All statuses</option>
          {["scheduled", "rescheduled", "completed", "cancelled", "no_show"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      <h2 className="mt-6 text-lg font-semibold">Upcoming ({upcoming.length})</h2>
      {upcoming.length === 0 ? (
        <div className="mt-2"><EmptyState title="No upcoming interviews" /></div>
      ) : (
        <div className="mt-3 space-y-3">{upcoming.map(renderInterview)}</div>
      )}

      <h2 className="mt-8 text-lg font-semibold">Past ({past.length})</h2>
      {past.length === 0 ? (
        <div className="mt-2"><EmptyState title="No past interviews" /></div>
      ) : (
        <div className="mt-3 space-y-3">{past.map(renderInterview)}</div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        All times shown in Asia/Karachi; stored in UTC. Meeting links are shown only when a genuine link was saved.
      </p>
    </main>
  );
}
