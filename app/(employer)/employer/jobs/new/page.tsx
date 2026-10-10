import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOrgContext, NoOrganizationError } from "../../../_lib/org";
import { NoOrgState } from "../../../_components/NoOrgState";
import { JobForm } from "../../../_components/JobForm";
import { createJob, getJobFormData } from "../actions";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  if (!["org_admin", "hr_manager", "recruiter"].includes(ctx.role)) {
    redirect(`/employer/jobs?org=${encodeURIComponent(ctx.orgId)}`);
  }

  const formData = await getJobFormData(ctx.orgId);
  const orgParam = `?org=${encodeURIComponent(ctx.orgId)}`;

  return (
    <main>
      <h1 className="text-2xl font-bold">Post a job</h1>
      <p className="mt-1 text-sm text-slate-500">
        The posting is saved as a draft. Publishing follows your organization&apos;s approval workflow.
      </p>
      <div className="mt-6">
        <JobForm
          departments={formData.departments}
          categories={formData.categories}
          locations={formData.locations}
          defaultDeadlineDays={formData.defaultDeadlineDays}
          mode="create"
          saveAction={createJob.bind(null, ctx.orgId)}
          successRedirect={`/employer/jobs${orgParam}`}
          cancelHref={`/employer/jobs${orgParam}`}
        />
      </div>
    </main>
  );
}
