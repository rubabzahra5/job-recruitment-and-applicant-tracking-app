import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getOrgContext, NoOrganizationError } from "../../../../_lib/org";
import { splitJobDescription } from "../../../../_lib/job-text";
import { NoOrgState } from "../../../../_components/NoOrgState";
import { JobForm, type JobFormDefaults } from "../../../../_components/JobForm";
import { getJobForEdit, getJobFormData, updateJob } from "../../actions";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const { jobId } = await params;
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

  let loaded;
  try {
    loaded = await getJobForEdit(jobId, ctx.orgId);
  } catch {
    notFound();
  }
  const { job, questions } = loaded;
  if (!["draft", "rejected", "approved"].includes(job.status as string)) {
    redirect(`/employer/jobs?org=${encodeURIComponent(ctx.orgId)}`);
  }

  const formData = await getJobFormData(ctx.orgId);
  const orgParam = `?org=${encodeURIComponent(ctx.orgId)}`;
  const parts = splitJobDescription((job.description as string) ?? "");

  const defaults: JobFormDefaults = {
    title: job.title as string,
    departmentId: (job.department_id as string | null) ?? null,
    categoryId: (job.category_id as string | null) ?? null,
    locationId: (job.location_id as string | null) ?? null,
    description: parts.description,
    responsibilities: (job.responsibilities as string | null) ?? null,
    qualifications: (job.qualifications as string | null) ?? null,
    skills: (job.skills as string[]) ?? [],
    experienceMin: (job.experience_min_years as number | null) ?? null,
    experienceMax: (job.experience_max_years as number | null) ?? null,
    educationLevel: (job.education_level as string | null) ?? null,
    employmentType: job.employment_type as string,
    workplace: job.workplace as string,
    salaryMin: job.salary_min != null ? Number(job.salary_min) : null,
    salaryMax: job.salary_max != null ? Number(job.salary_max) : null,
    salaryPeriod: job.salary_period as string,
    salaryDisclosed: (job.salary_disclosed as boolean) ?? false,
    openings: (job.openings as number) ?? 1,
    isFreshGraduateOk: (job.is_fresh_graduate_ok as boolean) ?? false,
    deadline: (job.deadline as string | null) ?? null,
    benefits: parts.benefits,
    instructions: parts.instructions,
  };

  return (
    <main>
      <h1 className="text-2xl font-bold">Edit job</h1>
      <p className="mt-1 text-sm text-slate-500">
        Editing is allowed while the posting is a draft, rejected, or approved (not yet published).
      </p>
      <div className="mt-6">
        <JobForm
          departments={formData.departments}
          categories={formData.categories}
          locations={formData.locations}
          defaultDeadlineDays={formData.defaultDeadlineDays}
          defaults={defaults}
          initialQuestions={questions}
          mode="edit"
          saveAction={updateJob.bind(null, ctx.orgId, jobId)}
          successRedirect={`/employer/jobs${orgParam}`}
          cancelHref={`/employer/jobs${orgParam}`}
        />
      </div>
    </main>
  );
}
