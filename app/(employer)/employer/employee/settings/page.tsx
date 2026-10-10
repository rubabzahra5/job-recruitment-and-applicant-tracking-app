import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getOrgContext, NoOrganizationError } from "../../../_lib/org";
import { NoOrgState } from "../../../_components/NoOrgState";
import { EmployeeSubNav } from "../../../_components/EmployeeSubNav";
import { NotificationPrefsForm } from "../../../_components/EmployeeForms";
import { getNotificationPrefs, requireEmployeePortal, updateNotificationPrefs } from "../actions";

export const metadata: Metadata = { title: "Employee settings" };

export default async function EmployeeSettingsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  await requireEmployeePortal(ctx.orgId);
  const prefs = await getNotificationPrefs(ctx.orgId);

  return (
    <main>
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="mt-4">
        <EmployeeSubNav orgId={ctx.orgId} current="/settings" />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationPrefsForm initial={prefs} saveAction={updateNotificationPrefs.bind(null, ctx.orgId)} />
        </CardContent>
      </Card>
    </main>
  );
}
