import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateOnlyKarachi, formatPKR, formatSalaryRange } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  getOrgContext,
  getAssignedApplicationIds,
  canViewSalary,
  NoOrganizationError,
} from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { OfferForm } from "../../_components/OfferForm";
import { OfferActions } from "../../_components/OfferActions";
import {
  createOffer,
  updateOffer,
  submitOfferForApproval,
  approveOffer,
  rejectOfferApproval,
  sendOffer,
  recordOfferDecision,
  withdrawOffer,
  expireOffer,
  markHired,
  getOfferableApplications,
} from "./actions";

export const metadata: Metadata = { title: "Offers" };

interface SearchParams {
  org?: string;
  status?: string;
  create?: string;
  application?: string;
  edit?: string;
}

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  pending_approval: "warning",
  sent: "info",
  accepted: "success",
  declined: "danger",
  withdrawn: "neutral",
  expired: "neutral",
};

export default async function OffersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
  const showSalary = canViewSalary(ctx.role);
  const assignedIds = ctx.role === "hiring_manager" ? await getAssignedApplicationIds(ctx.user.id) : null;

  let query = admin
    .from("offers")
    .select("id,application_id,salary_amount,salary_period,joining_date,expires_at,status,terms,created_by,created_at,applications!inner(id,user_id,stage,jobs(title))")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (sp.status) query = query.eq("status", sp.status);
  const { data: offers } = await query;

  let list = (offers ?? []) as Array<Record<string, unknown>>;
  if (assignedIds) list = list.filter((o) => assignedIds.has(o.application_id as string));

  // Candidate names.
  const candUserIds = [...new Set(list.map((o) => ((o.applications as { user_id: string }).user_id)))];
  const { data: candProfiles } = candUserIds.length > 0
    ? await admin.from("candidate_profiles").select("user_id,full_name").in("user_id", candUserIds)
    : { data: [] as { user_id: string; full_name: string }[] };
  const candNameByUser = new Map((candProfiles ?? []).map((c) => [c.user_id as string, c.full_name as string]));

  // Approval history for pending offers.
  const offerIds = list.map((o) => o.id as string);
  const { data: approvals } = offerIds.length > 0
    ? await admin.from("offer_approvals").select("offer_id,decision,note,created_at").in("offer_id", offerIds).order("created_at", { ascending: false })
    : { data: [] as { offer_id: string; decision: string; note: string | null; created_at: string }[] };
  const approvalsByOffer = new Map<string, { decision: string; note: string | null }[]>();
  for (const a of (approvals ?? []) as Array<{ offer_id: string; decision: string; note: string | null }>) {
    const arr = approvalsByOffer.get(a.offer_id) ?? [];
    arr.push({ decision: a.decision, note: a.note });
    approvalsByOffer.set(a.offer_id, arr);
  }

  const showCreate = sp.create === "1";
  const editingOffer = sp.edit ? list.find((o) => o.id === sp.edit) : undefined;
  let offerable: { id: string; label: string }[] = [];
  if (showCreate || editingOffer) {
    offerable = await getOfferableApplications(ctx.orgId);
  }

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Offers</h1>
        {!showCreate && !editingOffer && (
          <Link href={`/employer/offers?${orgParam}&create=1`}>
            <Button>Create offer</Button>
          </Link>
        )}
      </div>

      {(showCreate || editingOffer) && (
        <div className="mt-4">
          <OfferForm
            applications={offerable}
            preselectedApplicationId={sp.application ?? (editingOffer?.application_id as string | undefined)}
            existing={
              editingOffer
                ? {
                    salaryAmount: editingOffer.salary_amount != null ? Number(editingOffer.salary_amount) : null,
                    salaryPeriod: (editingOffer.salary_period as string | null) ?? null,
                    joiningDate: (editingOffer.joining_date as string | null) ?? null,
                    expiresAt: (editingOffer.expires_at as string | null) ?? null,
                    terms: (editingOffer.terms as string | null) ?? null,
                  }
                : null
            }
            saveAction={
              editingOffer
                ? updateOffer.bind(null, ctx.orgId, editingOffer.id as string)
                : createOffer.bind(null, ctx.orgId)
            }
            cancelHref={`/employer/offers?${orgParam}`}
            mode={editingOffer ? "edit" : "create"}
          />
        </div>
      )}

      <form method="get" className="mt-4 flex gap-2">
        <input type="hidden" name="org" value={ctx.orgId} />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Filter by status" className="h-10 rounded-md border border-slate-300 px-2 text-sm">
          <option value="">All statuses</option>
          {["draft", "pending_approval", "sent", "accepted", "declined", "withdrawn", "expired"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {list.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No offers" description="Create an offer for an application to start the approval flow." />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {list.map((o) => {
            const app = o.applications as { id: string; user_id: string; stage: string; jobs: { title: string } | null };
            const apprs = approvalsByOffer.get(o.id as string) ?? [];
            const expired = (o.status as string) === "sent" && !!o.expires_at && new Date(o.expires_at as string).getTime() <= Date.now();
            return (
              <Card key={o.id as string}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>
                      {candNameByUser.get(app.user_id) ?? "Candidate"} — {app.jobs?.title ?? "—"}
                    </CardTitle>
                    <Badge tone={STATUS_TONE[o.status as string] ?? "neutral"}>{(o.status as string).replace("_", " ")}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-slate-600">
                    Compensation:{" "}
                    {showSalary ? (
                      <span className="font-medium text-slate-900">
                        {o.salary_amount != null
                          ? formatSalaryRange(o.salary_amount as number, o.salary_amount as number, (o.salary_period as string) ?? "monthly")
                          : "Not specified"}
                      </span>
                    ) : (
                      <span className="italic">Restricted — visible to org admins and HR managers</span>
                    )}
                    {o.joining_date ? ` · Joining ${formatDateOnlyKarachi(o.joining_date as string)}` : ""}
                    {o.expires_at ? ` · Expires ${formatDateOnlyKarachi(o.expires_at as string)}` : ""}
                  </p>
                  {o.terms ? <p className="whitespace-pre-wrap text-slate-600">{o.terms as string}</p> : null}
                  {apprs.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Approval history: {apprs.map((a, i) => (
                        <span key={i} className="mr-2">{a.decision}{a.note ? ` (${a.note})` : ""}</span>
                      ))}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <OfferActions
                      offerId={o.id as string}
                      orgId={ctx.orgId}
                      status={o.status as string}
                      role={ctx.role}
                      isCreator={(o.created_by as string) === ctx.user.id}
                      expired={expired}
                      submitAction={submitOfferForApproval.bind(null, ctx.orgId)}
                      approveAction={approveOffer.bind(null, ctx.orgId)}
                      rejectApprovalAction={rejectOfferApproval.bind(null, ctx.orgId)}
                      sendAction={sendOffer.bind(null, ctx.orgId)}
                      decisionAction={recordOfferDecision.bind(null, ctx.orgId)}
                      withdrawAction={withdrawOffer.bind(null, ctx.orgId)}
                      expireAction={expireOffer.bind(null, ctx.orgId)}
                      hireAction={markHired.bind(null, ctx.orgId)}
                      editHref={(o.status as string) === "draft" ? `/employer/offers?${orgParam}&edit=${o.id as string}` : null}
                    />
                    <Link href={`/employer/applications/${app.id}?${orgParam}`} className="text-sm text-brand-700 hover:underline">
                      Open application
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Salary amounts are visible only to org admins and HR managers. Sending an offer notifies the candidate in-app;
        email is attempted when configured and the outcome is reported honestly.
      </p>
    </main>
  );
}
