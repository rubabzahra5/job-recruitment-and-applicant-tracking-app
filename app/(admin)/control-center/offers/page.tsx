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
import { formatDateKarachi, formatPKR } from "@/lib/format";

export const metadata: Metadata = { title: "Control Center — Offers" };
export const dynamic = "force-dynamic";

interface OfferMonitorRow {
  id: string;
  salary_amount: number | string | null;
  salary_period?: string;
  joining_date?: string | null;
  expires_at?: string | null;
  status: string;
  job: { id?: string; title?: string } | null;
  org: { name?: string } | null;
  app: { profile?: { email?: string } | null } | null;
}

const STATUS_TONES: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  pending_approval: "warning",
  sent: "info",
  accepted: "success",
  declined: "danger",
  withdrawn: "neutral",
  expired: "neutral",
};

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/offers"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params);
  const range = parseDateRange(params);
  const orgId = firstParam(params.org) ?? "";
  const status = firstParam(params.status) ?? "";

  let query = admin
    .from("offers")
    .select(
      "id,salary_amount,salary_period,joining_date,expires_at,status,created_at," +
        "job:jobs(id,title),org:organizations(name)," +
        "app:applications!offers_application_id_fkey(profile:profiles!applications_user_id_fkey(email))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  query = applyDateRange(query, range);
  if (orgId) query = query.eq("org_id", orgId);
  if (status) query = query.eq("status", status);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(`Failed to load offers: ${error.message}`);
  const rows = asRows<OfferMonitorRow>(data);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));
  const { data: orgs } = await admin.from("organizations").select("id,name").order("name").limit(200);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Offers — cross-org monitoring</h1>
        <p className="mt-1 text-sm text-slate-600">
          {count ?? 0} offers. Read-only here; pending approvals are decided in the Approvals queue.
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
        <CardHeader><CardTitle>Offers</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Job</TableHeaderCell>
                <TableHeaderCell>Organization</TableHeaderCell>
                <TableHeaderCell>Candidate</TableHeaderCell>
                <TableHeaderCell>Salary</TableHeaderCell>
                <TableHeaderCell>Joining</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Expires</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((o) => {
                const job = o.job as { id?: string; title?: string } | null;
                const org = o.org as { name?: string } | null;
                const app = o.app as { profile?: { email?: string } | null } | null;
                const st = o.status as string;
                return (
                  <TableRow key={o.id as string}>
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
                    <TableCell>{formatPKR(o.salary_amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {o.joining_date ? formatDateKarachi(`${o.joining_date}T00:00:00Z`, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONES[st] ?? "neutral"}>{st}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {o.expires_at ? formatDateKarachi(o.expires_at as string) : "—"}
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
