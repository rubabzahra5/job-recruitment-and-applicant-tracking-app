import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getOrgContext, NoOrganizationError } from "../../../_lib/org";
import { NoOrgState } from "../../../_components/NoOrgState";
import { EmployeeSubNav } from "../../../_components/EmployeeSubNav";
import { EmployeeProfileForm } from "../../../_components/EmployeeForms";
import { getEmployeeHome, requireEmployeePortal, updateEmployeeProfile } from "../actions";

export const metadata: Metadata = { title: "My profile" };

export default async function EmployeeProfilePage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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

  return (
    <main>
      <h1 className="text-2xl font-bold">My profile</h1>
      <div className="mt-4">
        <EmployeeSubNav orgId={ctx.orgId} current="/profile" />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeProfileForm
            initial={{ displayName: home.displayName, title: home.title }}
            saveAction={updateEmployeeProfile.bind(null, ctx.orgId)}
          />
          <dl className="mt-6 grid gap-2 border-t border-slate-100 pt-4 text-sm">
            <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{home.email}</dd></div>
            <div><dt className="text-slate-500">Department</dt><dd className="font-medium">{home.departmentName ?? "—"}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-slate-500">Email and department are managed by your organization admin.</p>
        </CardContent>
      </Card>
    </main>
  );
}
