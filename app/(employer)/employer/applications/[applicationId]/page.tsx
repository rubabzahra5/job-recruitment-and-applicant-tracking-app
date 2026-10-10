import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPipeline, allowedNextStages, type PipelineLoader } from "@/lib/pipeline";
import { formatDateKarachi, formatDateOnlyKarachi, formatPKR } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  getOrgContext,
  getOrgApplication,
  getAssignedApplicationIds,
  listOrgMembers,
  singleRow,
  NoOrganizationError,
} from "../../../_lib/org";
import { NoOrgState } from "../../../_components/NoOrgState";
import { StageMoveControl } from "../../../_components/StageMoveControl";
import { CvViewer } from "../../../_components/CvViewer";
import { AssignmentControl } from "../../../_components/AssignmentControl";
import {
  ApplicationWorkspace,
  type NoteRow,
  type ParsedRubric,
  type MessageRow,
} from "../../../_components/ApplicationWorkspace";
import {
  moveApplicationStage,
  assignApplication,
  unassignApplication,
  addNote,
  updateNote,
  deleteNote,
  saveRubric,
  sendCandidateMessage,
  getCvSignedUrl,
} from "../actions";

export const metadata: Metadata = { title: "Application" };

interface RubricPayload {
  kind: string;
  scores: Record<string, number>;
  comments: Record<string, string>;
  summary: string;
}

function parseRubric(note: string): RubricPayload | null {
  try {
    const p = JSON.parse(note) as RubricPayload;
    return p.kind === "rubric" ? p : null;
  } catch {
    return null;
  }
}

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const { applicationId } = await params;
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  const admin = createAdminClient();
  const canManage = ["org_admin", "hr_manager", "recruiter"].includes(ctx.role);

  let app;
  try {
    app = await getOrgApplication(admin, applicationId, ctx.orgId);
  } catch {
    notFound();
  }

  // Hiring managers may only open applications assigned to them.
  if (ctx.role === "hiring_manager") {
    const assigned = await getAssignedApplicationIds(ctx.user.id);
    if (!assigned.has(applicationId)) notFound();
  }

  const pipeline = await loadPipeline(admin as unknown as PipelineLoader);
  const stageLabel = (k: string) => pipeline.stages.find((s) => s.key === k)?.label ?? k;

  const [
    { data: job },
    { data: profile },
    { data: answers },
    { data: appDocs },
    { data: notes },
    { data: messages },
    { data: assignments },
    { data: history },
    { data: interviews },
    { data: offers },
  ] = await Promise.all([
    admin.from("jobs").select("id,title,departments(name)").eq("id", app.job_id).single(),
    admin.from("candidate_profiles").select("*").eq("user_id", app.user_id).maybeSingle(),
    admin.from("application_answers").select("question_text,answer").eq("application_id", applicationId),
    admin.from("application_documents").select("file_name,mime_type,size_bytes,created_at").eq("application_id", applicationId),
    admin.from("application_notes").select("id,note,author_user_id,created_at").eq("application_id", applicationId).order("created_at", { ascending: true }),
    admin.from("candidate_messages").select("id,message,is_from_candidate,sender_user_id,created_at").eq("application_id", applicationId).order("created_at", { ascending: true }),
    admin.from("application_assignments").select("id,assignee_user_id").eq("application_id", applicationId),
    admin.from("application_status_history").select("from_stage,to_stage,changed_by,reason,created_at").eq("application_id", applicationId).order("created_at", { ascending: false }),
    admin.from("interviews").select("id,scheduled_at,status,format").eq("application_id", applicationId).order("scheduled_at", { ascending: false }),
    admin.from("offers").select("id,status,salary_amount,created_at").eq("application_id", applicationId).order("created_at", { ascending: false }),
  ]);

  const profileId = (profile?.id as string | undefined) ?? null;
  const [{ data: education }, { data: experience }, { data: skills }, { data: certifications }] = profileId
    ? await Promise.all([
        admin.from("candidate_education").select("institution,degree,field,start_year,end_year,is_current").eq("profile_id", profileId).order("end_year", { ascending: false }),
        admin.from("candidate_experience").select("employer,title,start_date,end_date,is_current,description").eq("profile_id", profileId).order("start_date", { ascending: false }),
        admin.from("candidate_skills").select("skill,years").eq("profile_id", profileId),
        admin.from("candidate_certifications").select("name,issuer,issued_date").eq("profile_id", profileId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  // Names for notes/messages/history/assignments.
  const authorIds = [
    ...((notes ?? []).map((n) => n.author_user_id as string)),
    ...((messages ?? []).map((m) => m.sender_user_id as string)),
    ...((history ?? []).map((h) => h.changed_by as string | null)).filter((x): x is string => !!x),
    ...((assignments ?? []).map((a) => a.assignee_user_id as string)),
  ];
  const { data: authorProfiles } = authorIds.length > 0
    ? await admin.from("profiles").select("id,display_name,email").in("id", [...new Set(authorIds)])
    : { data: [] as { id: string; display_name: string | null; email: string }[] };
  const nameOf = (id: string | null) => {
    if (!id) return "System";
    const p = (authorProfiles ?? []).find((x) => (x.id as string) === id);
    return (p?.display_name as string | null) ?? (p?.email as string) ?? "Staff";
  };

  const noteRows: NoteRow[] = [];
  const rubricRows: ParsedRubric[] = [];
  for (const n of notes ?? []) {
    const rubric = parseRubric(n.note as string);
    const base = {
      noteId: n.id as string,
      authorName: nameOf(n.author_user_id as string),
      createdAt: n.created_at as string,
    };
    if (rubric) {
      rubricRows.push({ ...base, scores: rubric.scores, comments: rubric.comments, summary: rubric.summary });
    } else {
      noteRows.push({
        id: n.id as string,
        note: n.note as string,
        authorName: base.authorName,
        isOwn: (n.author_user_id as string) === ctx.user.id,
        canModerate: ["org_admin", "hr_manager"].includes(ctx.role),
        createdAt: base.createdAt,
      });
    }
  }
  const existingRubric = rubricRows.find((r) => r.authorName === nameOf(ctx.user.id)) ?? null;

  const messageRows: MessageRow[] = (messages ?? []).map((m) => ({
    id: m.id as string,
    message: m.message as string,
    isFromCandidate: m.is_from_candidate as boolean,
    senderName: nameOf(m.sender_user_id as string),
    createdAt: m.created_at as string,
  }));

  const orgParam = `?org=${encodeURIComponent(ctx.orgId)}`;
  const p = profile as Record<string, unknown> | null;
  const memberOptions = canManage
    ? (await listOrgMembers(ctx.orgId))
        .filter((m) => m.isActive)
        .map((m) => ({ userId: m.userId, name: m.displayName ?? m.email }))
    : [];

  return (
    <main>
      <Link href={`/employer/applications${orgParam}`} className="text-sm text-brand-700 hover:underline">
        ← All applications
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{(p?.full_name as string) ?? "Candidate"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Applied for <span className="font-medium text-slate-700">{(job?.title as string) ?? "—"}</span>
            {(() => {
              const dept = singleRow((job as { departments?: { name: string } | { name: string }[] | null } | null)?.departments);
              return dept?.name ? ` · ${dept.name}` : "";
            })()} ·{" "}
            {formatDateKarachi(app.submitted_at as string)}
          </p>
          <div className="mt-2">
            <Badge tone="info">{stageLabel(app.stage as string)}</Badge>
          </div>
        </div>
        {canManage && (
          <div className="w-64 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Change stage</p>
            <StageMoveControl
              orgId={ctx.orgId}
              applicationId={applicationId}
              currentStage={app.stage as string}
              allowedTargets={allowedNextStages(app.stage as string, pipeline.transitions).map((k) => ({
                key: k,
                label: stageLabel(k),
              }))}
              moveAction={moveApplicationStage}
            />
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Candidate snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              {!p ? (
                <p className="text-sm text-slate-500">No profile on file.</p>
              ) : (
                <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
                  <div><dt className="text-slate-500">Headline</dt><dd className="font-medium">{(p.headline as string) ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Location</dt><dd className="font-medium">{[p.city, p.province].filter(Boolean).join(", ") || "—"}</dd></div>
                  {canManage && (
                    <div><dt className="text-slate-500">Phone</dt><dd className="font-medium">{(p.phone as string) ?? "—"}</dd></div>
                  )}
                  <div><dt className="text-slate-500">Expected salary</dt><dd className="font-medium">{formatPKR(p.expected_salary as number | null)}</dd></div>
                  <div><dt className="text-slate-500">Notice period</dt><dd className="font-medium">{p.notice_period_days != null ? `${p.notice_period_days} days` : "—"}</dd></div>
                  <div><dt className="text-slate-500">Availability</dt><dd className="font-medium">{(p.availability as string) ?? "—"}</dd></div>
                  <div className="md:col-span-2"><dt className="text-slate-500">Summary</dt><dd className="whitespace-pre-wrap">{(p.summary as string) ?? "—"}</dd></div>
                  {(skills ?? []).length > 0 && (
                    <div className="md:col-span-2">
                      <dt className="text-slate-500">Skills</dt>
                      <dd className="mt-1 flex flex-wrap gap-1">
                        {(skills ?? []).map((s, i) => (
                          <Badge key={i} tone="neutral">{(s.skill as string)}{s.years ? ` · ${s.years}y` : ""}</Badge>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              {(experience ?? []).length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Experience</h3>
                  <ul className="mt-1 space-y-2 text-sm">
                    {(experience ?? []).map((e, i) => (
                      <li key={i} className="border-l-2 border-slate-200 pl-3">
                        <p className="font-medium">{e.title as string} · {e.employer as string}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateOnlyKarachi(e.start_date as string)} – {e.is_current ? "Present" : formatDateOnlyKarachi(e.end_date as string)}
                        </p>
                        {e.description && <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{e.description as string}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(education ?? []).length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Education</h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {(education ?? []).map((e, i) => (
                      <li key={i}>
                        <span className="font-medium">{e.degree as string}</span> · {e.institution as string}
                        {e.field ? ` (${e.field as string})` : ""}{" "}
                        <span className="text-xs text-slate-500">{e.start_year as number}–{e.is_current ? "present" : (e.end_year as number)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(certifications ?? []).length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Certifications</h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {(certifications ?? []).map((c, i) => (
                      <li key={i}>{c.name as string}{c.issuer ? ` · ${c.issuer as string}` : ""}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application answers</CardTitle>
            </CardHeader>
            <CardContent>
              {app.cover_letter ? (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold">Cover letter</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{app.cover_letter as string}</p>
                </div>
              ) : (
                <p className="mb-4 text-sm text-slate-500">No cover letter provided.</p>
              )}
              {(answers ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No screening answers.</p>
              ) : (
                <dl className="space-y-3">
                  {(answers ?? []).map((a, i) => (
                    <div key={i}>
                      <dt className="text-sm font-medium text-slate-700">{a.question_text as string}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{a.answer as string}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Team workspace</CardTitle>
              </CardHeader>
              <CardContent>
                <ApplicationWorkspace
                  notes={noteRows}
                  rubrics={rubricRows}
                  existingRubric={existingRubric}
                  messages={messageRows}
                  noteActions={{
                    add: addNote.bind(null, ctx.orgId, applicationId),
                    update: updateNote.bind(null, ctx.orgId),
                    remove: deleteNote.bind(null, ctx.orgId),
                  }}
                  rubricAction={saveRubric.bind(null, ctx.orgId, applicationId)}
                  messageAction={sendCandidateMessage.bind(null, ctx.orgId, applicationId)}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CV</CardTitle>
            </CardHeader>
            <CardContent>
              {(appDocs ?? []).length > 0 && (
                <ul className="mb-3 space-y-1 text-sm text-slate-600">
                  {(appDocs ?? []).map((d, i) => (
                    <li key={i}>
                      {d.file_name as string}{" "}
                      <span className="text-xs text-slate-400">
                        ({Math.round(((d.size_bytes as number) ?? 0) / 1024)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {canManage ? (
                <CvViewer getUrl={getCvSignedUrl.bind(null, ctx.orgId, applicationId)} hasCv={(appDocs ?? []).length > 0 || !!app.document_id || !!profileId} />
              ) : (
                <p className="text-sm text-slate-500">CV access requires a recruiter role or higher.</p>
              )}
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                <AssignmentControl
                  options={memberOptions}
                  assignments={(assignments ?? []).map((a) => ({
                    id: a.id as string,
                    userId: a.assignee_user_id as string,
                    name: nameOf(a.assignee_user_id as string),
                  }))}
                  assignAction={assignApplication.bind(null, ctx.orgId, applicationId)}
                  unassignAction={unassignApplication.bind(null, ctx.orgId)}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent>
              {(history ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No stage changes yet.</p>
              ) : (
                <ol className="space-y-3">
                  {(history ?? []).map((h, i) => (
                    <li key={i} className="border-l-2 border-brand-200 pl-3 text-sm">
                      <p className="font-medium">
                        {h.from_stage ? `${stageLabel(h.from_stage as string)} → ` : ""}
                        {stageLabel(h.to_stage as string)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {nameOf(h.changed_by as string | null)} · {formatDateKarachi(h.created_at as string)}
                      </p>
                      {h.reason && <p className="mt-0.5 text-xs italic text-slate-600">“{h.reason as string}”</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interviews & offers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h3 className="font-semibold">Interviews ({(interviews ?? []).length})</h3>
                {(interviews ?? []).length === 0 ? (
                  <p className="text-slate-500">None scheduled.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {(interviews ?? []).map((iv) => (
                      <li key={iv.id as string} className="flex justify-between">
                        <span>{formatDateKarachi(iv.scheduled_at as string)}</span>
                        <Badge tone="neutral">{iv.status as string}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && (
                  <Link href={`/employer/interviews${orgParam}&application=${applicationId}`}>
                    <Button variant="outline" size="sm" className="mt-2">Schedule interview</Button>
                  </Link>
                )}
              </div>
              <div>
                <h3 className="font-semibold">Offers ({(offers ?? []).length})</h3>
                {(offers ?? []).length === 0 ? (
                  <p className="text-slate-500">None created.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {(offers ?? []).map((o) => (
                      <li key={o.id as string} className="flex justify-between">
                        <span>{formatDateOnlyKarachi(o.created_at as string)}</span>
                        <Badge tone="neutral">{o.status as string}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
