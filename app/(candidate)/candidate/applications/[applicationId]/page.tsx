import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { StageBadge, stageLabel } from "@/app/(candidate)/_components/StageBadge";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateKarachi, formatSalaryRange, timeAgo } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { WithdrawButton, MessageComposer } from "../_components/ApplicationActions";

export const metadata: Metadata = { title: "Application details" };

interface PageProps {
  params: Promise<{ applicationId: string }>;
}

interface ApplicationRow {
  id: string;
  stage: string;
  cover_letter: string | null;
  submitted_at: string;
  withdrawn_at: string | null;
  job: {
    title: string;
    slug: string;
    employment_type: string;
    workplace: string;
    salary_min: number | null;
    salary_max: number | null;
    salary_period: string;
    salary_disclosed: boolean;
    deadline: string | null;
    org: { name: string } | null;
    location: { city: string; province: string } | null;
  } | null;
}

interface AnswerRow {
  id: string;
  question_text: string;
  answer: string;
}

interface DocRow {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

interface HistoryRow {
  id: string;
  from_stage: string | null;
  to_stage: string;
  reason: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  message: string;
  is_from_candidate: boolean;
  created_at: string;
}

// Stages from which the candidate portal offers withdrawal.
const WITHDRAWABLE = new Set([
  "applied",
  "initial_screening",
  "shortlisted",
  "assessment",
  "interview_scheduled",
  "interview_completed",
  "reference_check",
  "offer_pending",
]);

export default async function ApplicationDetailPage({ params }: PageProps) {
  const user = await requireCandidate();
  const { applicationId } = await params;
  const admin = createAdminClient();

  // Ownership enforced in the query filter (user_id = auth.uid()).
  const { data: appData, error: appError } = await admin
    .from("applications")
    .select(
      "id,stage,cover_letter,submitted_at,withdrawn_at,job:jobs(title,slug,employment_type,workplace,salary_min,salary_max,salary_period,salary_disclosed,deadline,org:organizations(name),location:locations(city,province))",
    )
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (appError) throw new Error(`Failed to load application: ${appError.message}`);
  const app = appData as unknown as ApplicationRow | null;
  if (!app) notFound();

  const [
    { data: answers },
    { data: docs },
    { data: history },
    { data: messages },
    { data: interviews },
  ] = await Promise.all([
    admin.from("application_answers").select("id,question_text,answer").eq("application_id", app.id).order("created_at"),
    admin.from("application_documents").select("id,file_name,mime_type,size_bytes").eq("application_id", app.id),
    admin.from("application_status_history").select("id,from_stage,to_stage,reason,created_at").eq("application_id", app.id).order("created_at", { ascending: false }),
    // Candidate-visible message thread. Internal recruiter notes
    // (application_notes) are deliberately NEVER queried here.
    admin.from("candidate_messages").select("id,message,is_from_candidate,created_at").eq("application_id", app.id).order("created_at"),
    admin.from("interviews").select("id,scheduled_at,duration_minutes,format,venue,meeting_link,status").eq("application_id", app.id).order("scheduled_at"),
  ]);

  const job = app.job;

  return (
    <main>
      <p className="mb-4 text-sm text-slate-500">
        <Link href="/candidate/applications" className="hover:underline">Applications</Link>
        {" / "}
        {job?.title ?? "Application"}
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{job?.title ?? "Application"}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {job?.org?.name ?? ""}
            {job?.location ? ` · ${job.location.city}, ${job.location.province}` : ""} · Applied{" "}
            {formatDateKarachi(app.submitted_at, { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StageBadge stage={app.stage} />
          <WithdrawButton applicationId={app.id} canWithdraw={WITHDRAWABLE.has(app.stage)} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Job snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              {job ? (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Employment type</dt>
                    <dd className="font-medium">{job.employment_type.replace(/_/g, " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Workplace</dt>
                    <dd className="font-medium">{job.workplace.replace(/_/g, " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Salary</dt>
                    <dd className="font-medium">
                      {job.salary_disclosed
                        ? formatSalaryRange(job.salary_min, job.salary_max, job.salary_period)
                        : "Not disclosed"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Deadline</dt>
                    <dd className="font-medium">
                      {job.deadline
                        ? formatDateKarachi(job.deadline, { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">This job posting is no longer available.</p>
              )}
              {job?.slug && (
                <p className="mt-3 text-sm">
                  <Link href={`/jobs/${job.slug}`} className="font-medium text-brand-700 hover:underline">
                    View full job posting →
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {(docs ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attached documents</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {((docs ?? []) as DocRow[]).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-800">{d.file_name}</span>
                      <a
                        href={`/candidate/applications/${app.id}/documents/${d.id}`}
                        className="shrink-0 font-medium text-brand-700 hover:underline"
                      >
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {app.cover_letter && (
            <Card>
              <CardHeader>
                <CardTitle>Cover letter</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-slate-700">{app.cover_letter}</p>
              </CardContent>
            </Card>
          )}

          {(answers ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your answers</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  {((answers ?? []) as AnswerRow[]).map((a) => (
                    <div key={a.id}>
                      <dt className="text-sm font-medium text-slate-500">{a.question_text}</dt>
                      <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-800">{a.answer}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          {(interviews ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Interviews</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {((interviews ?? []) as Array<{
                    id: string; scheduled_at: string; duration_minutes: number;
                    format: string; venue: string | null; meeting_link: string | null; status: string;
                  }>).map((iv) => (
                    <li key={iv.id} className="rounded-md border border-slate-200 p-3 text-sm">
                      <p className="font-medium">
                        {formatDateKarachi(iv.scheduled_at)} · {iv.duration_minutes} min ·{" "}
                        {iv.format.replace("_", " ")} · {iv.status}
                      </p>
                      {iv.venue && <p className="text-slate-600">Venue: {iv.venue}</p>}
                      {iv.meeting_link && (
                        <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">
                          Join meeting
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Conversation with the hiring team about this application.
              </p>
            </CardHeader>
            <CardContent>
              {((messages ?? []) as MessageRow[]).length === 0 ? (
                <EmptyState
                  title="No messages yet"
                  description="Messages from the hiring team will appear here."
                />
              ) : (
                <ul className="space-y-3">
                  {((messages ?? []) as MessageRow[]).map((m) => (
                    <li
                      key={m.id}
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        m.is_from_candidate
                          ? "ml-auto bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-line">{m.message}</p>
                      <p className={`mt-1 text-[11px] ${m.is_from_candidate ? "text-brand-100" : "text-slate-400"}`}>
                        {m.is_from_candidate ? "You" : "Hiring team"} · {timeAgo(m.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {app.stage !== "withdrawn" && <MessageComposer applicationId={app.id} />}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent>
              {((history ?? []) as HistoryRow[]).length === 0 ? (
                <p className="text-sm text-slate-500">No status changes yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-slate-200 pl-4">
                  {((history ?? []) as HistoryRow[]).map((h) => (
                    <li key={h.id} className="relative">
                      <span aria-hidden="true" className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-600 ring-4 ring-white" />
                      <p className="text-sm font-medium text-slate-900">
                        {h.from_stage ? `${stageLabel(h.from_stage)} → ` : ""}
                        {stageLabel(h.to_stage)}
                      </p>
                      {h.reason && <p className="text-xs text-slate-500">{h.reason}</p>}
                      <p className="text-xs text-slate-400">{formatDateKarachi(h.created_at)}</p>
                    </li>
                  ))}
                </ol>
              )}
              {app.withdrawn_at && (
                <Alert tone="info" className="mt-4">
                  Withdrawn on {formatDateKarachi(app.withdrawn_at)}. You may apply
                  again while the job is open.
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
