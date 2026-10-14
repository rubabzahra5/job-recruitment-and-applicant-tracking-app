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

/** Step 1: Full query + Table UI. No counts, filters, or action buttons yet. */
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

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="mt-1 text-sm text-slate-600">
          {orgs.length} total. (Step 1: table UI test)
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
