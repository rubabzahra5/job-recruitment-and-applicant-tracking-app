import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AdminDeniedError,
  adminPageGuard,
  applyDateRange,
  asRows,
  firstParam,
  getPagination,
  parseDateRange,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
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
import { formatDateKarachi } from "@/lib/format";

export const metadata: Metadata = { title: "Control Center — Interviews" };
export const dynamic = "force-dynamic";

interface InterviewRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  format: string;
  status: string;
  job: { id?: string; title?: string } | null;
  org: { name?: string } | null;
  app: { profile?: { email?: string } | null } | null;
}

const STATUS_TONES: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  scheduled: "info",
  rescheduled: "warning",
  cancelled: "neutral",
  completed: "success",
  no_show: "danger",
};

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/interviews"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params);
  const range = parseDateRange(params);
  const orgId = firstParam(params.org) ?? "";
  const status = firstParam(params.status) ?? "";

  let query = admin
    .from("interviews")
    .select(
      "id,scheduled_at,duration_minutes,format,status,timezone," +
        "job:jobs(id,title),org:organizations(name)," +
        "app:applications!interviews_application_id_fkey(profile:profiles!applications_user_id_fkey(email))",
      { count: "exact" },
    )
    .order("scheduled_at", { ascending: false });
  query = applyDateRange(query, range, "scheduled_at");
  if (orgId) query = query.eq("org_id", orgId);
  if (status) query = query.eq("status", status);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(`Failed to load interviews: ${error.message}`);
  const rows = asRows<InterviewRow>(data);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));
  const { data: orgs } = await admin.from("organizations").select("id,name").order("name").limit(200);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Interviews — cross-org monitoring</h1>
        <p className="mt-1 text-sm text-slate-600">
          {count ?? 0} interviews. Read-only; scheduling is done by org staff.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Suspense>
            <FilterBar
              fields={[
                {
                  key: "org",
                  label: "Organization",
                  type: "select",
                  options: (orgs ?? []).map((o) => ({ value: o.id as string, label: o.name as string })),
                },
                {
                  key: "status",
                  label: "Status",
                  type: "select",
                  options: Object.keys(STATUS_TONES).map((s) => ({ value: s, label: s })),
                },
                { key: "from", label: "From", type: "date" },
                { key: "to", label: "To", type: "date" },
              ]}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Interviews</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Scheduled (PKT)</TableHeaderCell>
                <TableHeaderCell>Job</TableHeaderCell>
                <TableHeaderCell>Organization</TableHeaderCell>
                <TableHeaderCell>Candidate</TableHeaderCell>
                <TableHeaderCell>Format</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((i) => {
                const job = i.job as { id?: string; title?: string } | null;
                const org = i.org as { name?: string } | null;
                const app = i.app as { profile?: { email?: string } | null } | null;
                const st = i.status as string;
                return (
                  <TableRow key={i.id as string}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateKarachi(i.scheduled_at as string)}
                      <div className="text-xs text-slate-500">{i.duration_minutes as number} min</div>
                    </TableCell>
                    <TableCell>
                      {job?.id ? (
                        <Link href={`/control-center/jobs/${job.id}`} className="text-brand-700 hover:underline">
                          {job.title ?? "—"}
                        </Link>
                      ) : (
                        job?.title ?? "—"
                      )}
                    </TableCell>
                    <TableCell>{org?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{app?.profile?.email ?? "—"}</TableCell>
                    <TableCell>{i.format as string}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONES[st] ?? "neutral"}>{st}</Badge>
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
