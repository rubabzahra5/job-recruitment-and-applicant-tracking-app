import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getOrgContext, NoOrganizationError } from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { EmployeeSubNav } from "../../_components/EmployeeSubNav";
import { getEmployeeHome, requireEmployeePortal } from "./actions";

export const metadata: Metadata = { title: "Employee portal" };

export default async function EmployeeHomePage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  await requireEmployeePortal(ctx.orgId);
  const home = await getEmployeeHome(ctx.orgId);
  const orgParam = `?org=${encodeURIComponent(ctx.orgId)}`;

  return (
    <main>
      <h1 className="text-2xl font-bold">Employee portal</h1>
      <p className="mt-1 text-sm text-slate-500">
        Welcome{home.displayName ? `, ${home.displayName}` : ""} — {home.orgName}
      </p>
      <div className="mt-4">
        <EmployeeSubNav orgId={ctx.orgId} current="" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{home.displayName ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{home.email}</dd></div>
              <div><dt className="text-slate-500">Job title</dt><dd className="font-medium">{home.title ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Department</dt><dd className="font-medium">{home.departmentName ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Portal role</dt><dd className="font-medium">{home.role?.replace("_", " ") ?? "—"}</dd></div>
            </dl>
            <Link href={`/employer/employee/profile${orgParam}`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
              Update profile →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/employer/employee/documents${orgParam}`} className="text-brand-700 hover:underline">My documents</Link><p className="text-xs text-slate-500">Download your uploaded CVs and documents.</p></li>
              <li><Link href={`/employer/employee/requests${orgParam}`} className="text-brand-700 hover:underline">HR requests</Link><p className="text-xs text-slate-500">Send a request to your HR team.</p></li>
              <li><Link href={`/employer/employee/settings${orgParam}`} className="text-brand-700 hover:underline">Notification settings</Link><p className="text-xs text-slate-500">Control how you are notified.</p></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
