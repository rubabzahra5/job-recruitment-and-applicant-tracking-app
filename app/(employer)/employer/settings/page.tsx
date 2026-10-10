import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getOrgContext, NoOrganizationError } from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { OrgSettingsForm } from "../../_components/OrgSettingsForm";
import { getSettingsPageData, updateOrgSettings } from "./actions";

export const metadata: Metadata = { title: "Organization settings" };

export default async function OrgSettingsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  if (ctx.role !== "org_admin" && ctx.role !== "hr_manager") {
    redirect(`/employer?org=${encodeURIComponent(ctx.orgId)}`);
  }

  const settings = await getSettingsPageData(ctx.orgId);
  const canEdit = ctx.role === "org_admin";

  return (
    <main>
      <h1 className="text-2xl font-bold">Organization settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Recruitment preferences for {ctx.org.name}. These settings are enforced by the application code.
      </p>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recruitment</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <OrgSettingsForm initial={settings} saveAction={updateOrgSettings.bind(null, ctx.orgId)} />
          ) : (
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              <div><dt className="text-slate-500">Maximum active job postings</dt><dd className="font-medium">{settings.max_active_job_postings ?? "No limit"}</dd></div>
              <div><dt className="text-slate-500">Default application deadline</dt><dd className="font-medium">{settings.default_deadline_days ?? 30} days</dd></div>
              <div><dt className="text-slate-500">Notify recruiters on new applications</dt><dd className="font-medium">{settings.notify_recruiters_on_new_application ? "Yes" : "No"}</dd></div>
            </dl>
          )}
          {!canEdit && <p className="mt-3 text-xs text-slate-500">Only org admins can change settings.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
