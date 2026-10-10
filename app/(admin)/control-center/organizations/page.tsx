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
import { OrgFormDialog } from "./OrgFormDialog";
import { setOrgAccountStatus, setOrgVerification } from "./actions";

export const metadata: Metadata = { title: "Control Center — Organizations" };
export const dynamic = "force-dynamic";

const VERIFICATION_TONES: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  unverified: "neutral",
  pending: "warning",
  verified: "success",
  rejected: "danger",
};
const ACCOUNT_TONES: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  active: "success",
  suspended: "danger",
  closed: "neutral",
};

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/organizations"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params);
  const search = (firstParam(params.q) ?? "").trim();
  const verification = firstParam(params.verification) ?? "";
  const account = firstParam(params.account) ?? "";

  let query = admin
    .from("organizations")
    .select("id,name,slug,verification_status,account_status,industry,created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });
  if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  if (verification) query = query.eq("verification_status", verification);
  if (account) query = query.eq("account_status", account);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(`Failed to load organizations: ${error.message}`);
  const orgs = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  // Member + job counts for the visible rows (batched).
  const orgIds = orgs.map((o) => o.id as string);
  const [memberCounts, jobCounts] = await Promise.all([
    (async () => {
      const map = new Map<string, number>();
      if (orgIds.length === 0) return map;
      const { data: rows } = await admin
        .from("organization_memberships")
        .select("org_id")
        .in("org_id", orgIds)
        .eq("is_active", true);
      for (const r of rows ?? []) map.set(r.org_id as string, (map.get(r.org_id as string) ?? 0) + 1);
      return map;
    })(),
    (async () => {
      const map = new Map<string, number>();
      if (orgIds.length === 0) return map;
      const { data: rows } = await admin.from("jobs").select("org_id").in("org_id", orgIds);
      for (const r of rows ?? []) map.set(r.org_id as string, (map.get(r.org_id as string) ?? 0) + 1);
      return map;
    })(),
  ]);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="mt-1 text-sm text-slate-600">
            {count ?? 0} total. Suspending an org removes its jobs from public listings
            (public queries filter on account_status = active).
          </p>
        </div>
        <OrgFormDialog mode="create" triggerLabel="Create organization" />
      </div>

      <Card>
        <CardContent className="pt-4">
          <Suspense>
            <FilterBar
              fields={[
                { key: "q", label: "Search name/slug", type: "search", placeholder: "Acme…" },
                {
                  key: "verification",
                  label: "Verification",
                  type: "select",
                  options: ["unverified", "pending", "verified", "rejected"].map((v) => ({
                    value: v,
                    label: v,
                  })),
                },
                {
                  key: "account",
                  label: "Account status",
                  type: "select",
                  options: ["active", "suspended", "closed"].map((v) => ({ value: v, label: v })),
                },
              ]}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Organization</TableHeaderCell>
                <TableHeaderCell>Verification</TableHeaderCell>
                <TableHeaderCell>Account</TableHeaderCell>
                <TableHeaderCell>Members</TableHeaderCell>
                <TableHeaderCell>Jobs</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orgs.map((o) => {
                const id = o.id as string;
                const vs = o.verification_status as string;
                const as = o.account_status as string;
                return (
                  <TableRow key={id}>
                    <TableCell>
                      <Link
                        href={`/control-center/organizations/${id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {o.name as string}
                      </Link>
                      <div className="text-xs text-slate-500">{o.slug as string}</div>
                    </TableCell>
                    <TableCell>
                      <Badge tone={VERIFICATION_TONES[vs] ?? "neutral"}>{vs}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge tone={ACCOUNT_TONES[as] ?? "neutral"}>{as}</Badge>
                    </TableCell>
                    <TableCell>{memberCounts.get(id) ?? 0}</TableCell>
                    <TableCell>{jobCounts.get(id) ?? 0}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDateOnlyKarachi(o.created_at as string)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {vs === "pending" && (
                          <>
                            <NoteActionButton
                              title="Verify organization"
                              description={`Approve ${o.name as string} as a verified employer.`}
                              confirmLabel="Verify"
                              buttonLabel="Verify"
                              payload={{ id, status: "verified" }}
                              action={setOrgVerification}
                            />
                            <NoteActionButton
                              title="Reject verification"
                              danger
                              confirmLabel="Reject"
                              buttonLabel="Reject"
                              payload={{ id, status: "rejected" }}
                              action={setOrgVerification}
                            />
                          </>
                        )}
                        {as === "active" ? (
                          <NoteActionButton
                            title="Suspend organization"
                            description="Suspended orgs disappear from public job listings immediately. Existing applications remain accessible to staff."
                            danger
                            confirmLabel="Suspend"
                            buttonLabel="Suspend"
                            payload={{ id, status: "suspended" }}
                            action={setOrgAccountStatus}
                          />
                        ) : (
                          as === "suspended" && (
                            <ConfirmActionButton
                              title="Reactivate organization"
                              message="Restore this organization to active status?"
                              confirmLabel="Reactivate"
                              buttonLabel="Reactivate"
                              payload={{ id, status: "active" }}
                              action={async (p) => setOrgAccountStatus(p, "Reactivated by super admin.")}
                            />
                          )
                        )}
                        {as !== "closed" && (
                          <ConfirmActionButton
                            title="Archive organization"
                            message="Archive (close) this organization? Its data is retained for audit."
                            confirmLabel="Archive"
                            danger
                            buttonLabel="Archive"
                            payload={{ id, status: "closed" }}
                            action={async (p) => setOrgAccountStatus(p, "Archived by super admin.")}
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
