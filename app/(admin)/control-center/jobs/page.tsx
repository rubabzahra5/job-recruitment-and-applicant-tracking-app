import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AdminDeniedError,
  adminPageGuard,
  firstParam,
  getPagination,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import {
  ConfirmActionButton,
  NoteActionButton,
} from "@/app/(admin)/_components/action-buttons";
import { FilterBar, PaginationNav } from "@/app/(admin)/_components/filters";
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
import { formatDateOnlyKarachi } from "@/lib/format";
import { moderateJob, setJobStatus } from "./actions";

export const metadata: Metadata = { title: "Control Center — Jobs" };
export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  pending_review: "warning",
  approved: "info",
  published: "success",
  paused: "warning",
  closed: "neutral",
  rejected: "danger",
  archived: "neutral",
};
const STATUSES = Object.keys(STATUS_TONES);

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/jobs"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params);
  const search = (firstParam(params.q) ?? "").trim();
  const status = firstParam(params.status) ?? "";
  const orgId = firstParam(params.org) ?? "";
  const categoryId = firstParam(params.category) ?? "";

  let query = admin
    .from("jobs")
    .select(
      "id,title,status,created_at,org:organizations(id,name),cat:job_categories(id,name),loc:locations(city,province)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (search) query = query.ilike("title", `%${search}%`);
  if (status) query = query.eq("status", status);
  if (orgId) query = query.eq("org_id", orgId);
  if (categoryId) query = query.eq("category_id", categoryId);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(`Failed to load jobs: ${error.message}`);
  const jobs = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  const jobIds = jobs.map((j) => j.id as string);
  const appCounts = new Map<string, number>();
  if (jobIds.length > 0) {
    const { data: apps } = await admin.from("applications").select("job_id").in("job_id", jobIds);
    for (const a of apps ?? []) {
      const jid = a.job_id as string;
      appCounts.set(jid, (appCounts.get(jid) ?? 0) + 1);
    }
  }
  const [orgsRes, catsRes] = await Promise.all([
    admin.from("organizations").select("id,name").order("name").limit(200),
    admin.from("job_categories").select("id,name").order("name"),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jobs — cross-org moderation</h1>
        <p className="mt-1 text-sm text-slate-600">
          {count ?? 0} jobs. Approval decisions are saved with moderator notes.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Suspense>
            <FilterBar
              fields={[
                { key: "q", label: "Search title", type: "search", placeholder: "Software engineer…" },
                {
                  key: "status",
                  label: "Status",
                  type: "select",
                  options: STATUSES.map((s) => ({ value: s, label: s })),
                },
                {
                  key: "org",
                  label: "Organization",
                  type: "select",
                  options: (orgsRes.data ?? []).map((o) => ({ value: o.id as string, label: o.name as string })),
                },
                {
                  key: "category",
                  label: "Category",
                  type: "select",
                  options: (catsRes.data ?? []).map((c) => ({ value: c.id as string, label: c.name as string })),
                },
              ]}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All jobs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Job</TableHeaderCell>
                <TableHeaderCell>Organization</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Applications</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((j) => {
                const id = j.id as string;
                const st = j.status as string;
                const org = j.org as { name?: string } | null;
                const cat = j.cat as { name?: string } | null;
                return (
                  <TableRow key={id}>
                    <TableCell>
                      <Link href={`/control-center/jobs/${id}`} className="font-medium text-brand-700 hover:underline">
                        {j.title as string}
                      </Link>
                    </TableCell>
                    <TableCell>{org?.name ?? "—"}</TableCell>
                    <TableCell>{cat?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONES[st] ?? "neutral"}>{st}</Badge>
                    </TableCell>
                    <TableCell>{appCounts.get(id) ?? 0}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDateOnlyKarachi(j.created_at as string)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {st === "pending_review" && (
                          <>
                            <NoteActionButton
                              title="Approve job"
                              description="Approve this job posting for publication."
                              confirmLabel="Approve"
                              buttonLabel="Approve"
                              payload={{ jobId: id, decision: "approved" }}
                              action={moderateJob}
                            />
                            <NoteActionButton
                              title="Reject job"
                              danger
                              confirmLabel="Reject"
                              buttonLabel="Reject"
                              payload={{ jobId: id, decision: "rejected" }}
                              action={moderateJob}
                            />
                          </>
                        )}
                        {(st === "draft" || st === "approved") && (
                          <ConfirmActionButton
                            title="Publish job"
                            message="Publish this job so it becomes publicly visible?"
                            confirmLabel="Publish"
                            buttonLabel="Publish"
                            payload={{ jobId: id, status: "published" }}
                            action={setJobStatus}
                          />
                        )}
                        {st === "published" && (
                          <ConfirmActionButton
                            title="Pause job"
                            message="Pause this job? It will be hidden from public listings."
                            confirmLabel="Pause"
                            buttonLabel="Pause"
                            payload={{ jobId: id, status: "paused" }}
                            action={setJobStatus}
                          />
                        )}
                        {!["closed", "archived"].includes(st) && (
                          <ConfirmActionButton
                            title="Close job"
                            message="Close this job to new applications?"
                            confirmLabel="Close"
                            buttonLabel="Close"
                            payload={{ jobId: id, status: "closed" }}
                            action={setJobStatus}
                          />
                        )}
                        {st !== "archived" && (
                          <ConfirmActionButton
                            title="Archive job"
                            message="Archive this job? It stays in the database for audit."
                            confirmLabel="Archive"
                            danger
                            buttonLabel="Archive"
                            payload={{ jobId: id, status: "archived" }}
                            action={setJobStatus}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Suspense>
            <PaginationNav page={page} totalPages={totalPages} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
