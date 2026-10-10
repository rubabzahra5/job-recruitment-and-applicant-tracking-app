import type { Metadata } from "next";
import Link from "next/link";
import { AdminDeniedError, adminPageGuard, asRows } from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { NoteActionButton } from "@/app/(admin)/_components/action-buttons";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { formatDateKarachi, formatPKR } from "@/lib/format";
import { setOrgVerification } from "../organizations/actions";
import { moderateJob } from "../jobs/actions";
import { decideOffer } from "./actions";

export const metadata: Metadata = { title: "Control Center — Approvals" };
export const dynamic = "force-dynamic";

interface PendingOfferRow {
  id: string;
  salary_amount: number | string | null;
  salary_period: string;
  created_at: string;
  job: { title?: string } | null;
  org: { name?: string } | null;
  app: { profile?: { email?: string } | null } | null;
}

export default async function ApprovalsPage() {
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/approvals"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  const [orgsRes, jobsRes, offersRes] = await Promise.all([
    admin
      .from("organizations")
      .select("id,name,slug,industry,created_at")
      .eq("verification_status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("jobs")
      .select("id,title,created_at,org:organizations(name)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("offers")
      .select(
        "id,salary_amount,salary_period,created_at,job:jobs(title),org:organizations(name)," +
          "app:applications!offers_application_id_fkey(profile:profiles!applications_user_id_fkey(email))",
      )
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const pendingOrgs = orgsRes.data ?? [];
  const pendingJobs = jobsRes.data ?? [];
  const pendingOffers = asRows<PendingOfferRow>(offersRes.data);
  const total = pendingOrgs.length + pendingJobs.length + pendingOffers.length;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approval queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          {total} item(s) awaiting moderation: organizations, jobs and offers. Every decision
          requires a note and is audit-logged.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations awaiting verification ({pendingOrgs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingOrgs.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing pending.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Organization</TableHeaderCell>
                  <TableHeaderCell>Industry</TableHeaderCell>
                  <TableHeaderCell>Requested</TableHeaderCell>
                  <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingOrgs.map((o) => (
                  <TableRow key={o.id as string}>
                    <TableCell>
                      <Link href={`/control-center/organizations/${o.id as string}`} className="font-medium text-brand-700 hover:underline">
                        {o.name as string}
                      </Link>
                      <div className="text-xs text-slate-500">{o.slug as string}</div>
                    </TableCell>
                    <TableCell>{(o.industry as string) ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDateKarachi(o.created_at as string)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <NoteActionButton
                          title="Verify organization"
                          confirmLabel="Verify"
                          buttonLabel="Verify"
                          payload={{ id: o.id as string, status: "verified" }}
                          action={setOrgVerification}
                        />
                        <NoteActionButton
                          title="Reject verification"
                          danger
                          confirmLabel="Reject"
                          buttonLabel="Reject"
                          payload={{ id: o.id as string, status: "rejected" }}
                          action={setOrgVerification}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jobs awaiting review ({pendingJobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingJobs.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing pending.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Job</TableHeaderCell>
                  <TableHeaderCell>Organization</TableHeaderCell>
                  <TableHeaderCell>Submitted</TableHeaderCell>
                  <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingJobs.map((j) => {
                  const org = j.org as { name?: string } | null;
                  return (
                    <TableRow key={j.id as string}>
                      <TableCell>
                        <Link href={`/control-center/jobs/${j.id as string}`} className="font-medium text-brand-700 hover:underline">
                          {j.title as string}
                        </Link>
                      </TableCell>
                      <TableCell>{org?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDateKarachi(j.created_at as string)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <NoteActionButton
                            title="Approve job"
                            confirmLabel="Approve"
                            buttonLabel="Approve"
                            payload={{ jobId: j.id as string, decision: "approved" }}
                            action={moderateJob}
                          />
                          <NoteActionButton
                            title="Reject job"
                            danger
                            confirmLabel="Reject"
                            buttonLabel="Reject"
                            payload={{ jobId: j.id as string, decision: "rejected" }}
                            action={moderateJob}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offers awaiting approval ({pendingOffers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingOffers.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing pending.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Job</TableHeaderCell>
                  <TableHeaderCell>Organization</TableHeaderCell>
                  <TableHeaderCell>Candidate</TableHeaderCell>
                  <TableHeaderCell>Salary</TableHeaderCell>
                  <TableHeaderCell>Submitted</TableHeaderCell>
                  <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingOffers.map((o) => {
                  const job = o.job as { title?: string } | null;
                  const org = o.org as { name?: string } | null;
                  const app = o.app as { profile?: { email?: string } | null } | null;
                  return (
                    <TableRow key={o.id as string}>
                      <TableCell>{job?.title ?? "—"}</TableCell>
                      <TableCell>{org?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{app?.profile?.email ?? "—"}</TableCell>
                      <TableCell>
                        {formatPKR(o.salary_amount)}
                        <span className="text-xs text-slate-500"> / {(o.salary_period as string) ?? ""}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDateKarachi(o.created_at as string)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <NoteActionButton
                            title="Approve offer"
                            description="Approved offers move to “sent”."
                            confirmLabel="Approve"
                            buttonLabel="Approve"
                            payload={{ offerId: o.id as string, decision: "approved" }}
                            action={decideOffer}
                          />
                          <NoteActionButton
                            title="Reject offer"
                            description="Rejected offers return to “draft”."
                            danger
                            confirmLabel="Reject"
                            buttonLabel="Reject"
                            payload={{ offerId: o.id as string, decision: "rejected" }}
                            action={decideOffer}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <div className="mt-3">
            <Badge tone="neutral">Decisions recorded in offer_approvals with notes</Badge>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
