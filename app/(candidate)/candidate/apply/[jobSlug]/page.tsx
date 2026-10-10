import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireCandidate,
  getOrCreateCandidateProfile,
} from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateKarachi } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ApplyWizard, type WizardJob } from "./_components/ApplyWizard";

export const metadata: Metadata = { title: "Apply for job" };

interface PageProps {
  params: Promise<{ jobSlug: string }>;
}

interface JobRow {
  id: string;
  title: string;
  slug: string;
  description: string;
  responsibilities: string | null;
  qualifications: string | null;
  skills: string[];
  employment_type: string;
  workplace: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string;
  salary_disclosed: boolean;
  deadline: string | null;
  experience_min_years: number | null;
  experience_max_years: number | null;
  education_level: string | null;
  is_fresh_graduate_ok: boolean;
  status: string;
  org: { name: string } | null;
  location: { city: string; province: string } | null;
  category: { name: string } | null;
}

export default async function ApplyPage({ params }: PageProps) {
  const user = await requireCandidate();
  const { jobSlug } = await params;
  const admin = createAdminClient();

  const { data: jobData, error: jobError } = await admin
    .from("jobs")
    .select(
      "id,title,slug,description,responsibilities,qualifications,skills,employment_type,workplace,salary_min,salary_max,salary_period,salary_disclosed,deadline,experience_min_years,experience_max_years,education_level,is_fresh_graduate_ok,status,org:organizations(name),location:locations(city,province),category:job_categories(name)",
    )
    .eq("slug", jobSlug)
    .maybeSingle();
  if (jobError) throw new Error(`Failed to load job: ${jobError.message}`);
  const job = jobData as unknown as JobRow | null;
  if (!job || job.status !== "published") notFound();

  const closed = job.deadline != null && new Date(job.deadline).getTime() <= Date.now();

  // candidate_documents is keyed by profile_id (not user_id).
  const profile = await getOrCreateCandidateProfile(user.id);
  const [{ data: existingApp }, { data: questions }, { data: cvs }] =
    await Promise.all([
      admin
        .from("applications")
        .select("id")
        .eq("user_id", user.id)
        .eq("job_id", job.id)
        .is("withdrawn_at", null)
        .maybeSingle(),
      admin
        .from("job_questions")
        .select("id,question,is_required")
        .eq("job_id", job.id)
        .order("sort_order"),
      admin
        .from("candidate_documents")
        .select("id,file_name,is_current_cv,created_at")
        .eq("profile_id", profile.id)
        .eq("kind", "cv")
        .order("created_at", { ascending: false }),
    ]);

  const existing = existingApp as { id: string } | null;

  if (closed) {
    return (
      <main>
        <Card>
          <CardHeader>
            <CardTitle>{job.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert tone="warning" title="Applications closed">
              The deadline for this job was {formatDateKarachi(job.deadline)}.
              You can no longer apply, but you can save similar jobs or set up
              a job alert.
            </Alert>
            <div className="mt-4 flex gap-2">
              <Link href="/jobs">
                <Button variant="primary">Browse jobs</Button>
              </Link>
              <Link href="/candidate/job-alerts">
                <Button variant="outline">Create job alert</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (existing) {
    return (
      <main>
        <Card>
          <CardHeader>
            <CardTitle>{job.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert tone="info" title="You've already applied">
              Your application for this job is active. You can track its status
              from your applications page.
            </Alert>
            <div className="mt-4">
              <Link href={`/candidate/applications/${existing.id}`}>
                <Button variant="primary">View my application</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const wizardJob: WizardJob = {
    title: job.title,
    slug: job.slug,
    description: job.description,
    responsibilities: job.responsibilities,
    qualifications: job.qualifications,
    skills: job.skills ?? [],
    employment_type: job.employment_type,
    workplace: job.workplace,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_period: job.salary_period,
    salary_disclosed: job.salary_disclosed,
    deadline: job.deadline,
    experience_min_years: job.experience_min_years,
    experience_max_years: job.experience_max_years,
    education_level: job.education_level,
    is_fresh_graduate_ok: job.is_fresh_graduate_ok,
    orgName: job.org?.name ?? "Employer",
    city: job.location?.city ?? null,
    province: job.location?.province ?? null,
    categoryName: job.category?.name ?? null,
  };

  return (
    <main>
      <p className="mb-4 text-sm text-slate-500">
        <Link href="/jobs" className="hover:underline">Jobs</Link>
        {" / "}
        <Link href={`/jobs/${job.slug}`} className="hover:underline">{job.title}</Link>
        {" / Apply"}
      </p>
      <ApplyWizard
        job={wizardJob}
        questions={(questions ?? []) as Array<{ id: string; question: string; is_required: boolean }>}
        cvs={(cvs ?? []) as Array<{ id: string; file_name: string; is_current_cv: boolean; created_at: string }>}
        candidateName={profile.full_name}
      />
    </main>
  );
}
