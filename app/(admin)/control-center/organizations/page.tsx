import type { Metadata } from "next";
import Link from "next/link";
import {
  AdminDeniedError,
  adminPageGuard,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
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

/** Step 2: Added member/job counts. */
export default async function OrganizationsPage() {
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/organizations"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  const { data, error } = await admin
    .from("organizations")
    .select("id,name,slug,verification_status,account_status,industry,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load organizations: ${error.message}`);
  const orgs = data ?? [];

  // Member + job counts for the visible rows (batched).
  const orgIds = orgs.map((o: any) => o.id as string);
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
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="mt-1 text-sm text-slate-600">
          {orgs.length} total. (Step 2: member/job counts test)
        </p>
      </div>

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
              </TableRow>
            </TableHead>
            <TableBody>
              {orgs.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/control-center/organizations/${o.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {o.name}
                    </Link>
                    <div className="text-xs text-slate-500">{o.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge tone={VERIFICATION_TONES[o.verification_status] ?? "neutral"}>
                      {o.verification_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge tone={ACCOUNT_TONES[o.account_status] ?? "neutral"}>
                      {o.account_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{memberCounts.get(o.id) ?? 0}</TableCell>
                  <TableCell>{jobCounts.get(o.id) ?? 0}</TableCell>
                  <TableCell className="whitespace-nowrap text-slate-500">
                    {formatDateOnlyKarachi(o.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
