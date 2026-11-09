import type { Metadata } from "next";
import Link from "next/link";
import {
  requireCandidate,
  getOrCreateCandidateProfile,
  getLocations,
} from "@/app/(candidate)/_lib/candidate-guard";
import { computeProfileCompletion } from "@/app/(candidate)/_lib/profile-completion";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CVUploadCard } from "./_components/CVUploadCard";
import { PublicProfileToggle } from "./_components/PublicProfileToggle";
import {
  ContactForm,
  SummaryForm,
  PreferencesForm,
  PortfolioForm,
  LanguagesForm,
} from "./_components/ProfileForms";
import {
  EducationManager,
  ExperienceManager,
  SkillsManager,
  CertificationsManager,
  type EducationRow,
  type ExperienceRow,
  type SkillRow,
  type CertificationRow,
} from "./_components/ProfileLists";
import { readPortfolioEntries } from "./_actions";

export const metadata: Metadata = { title: "My Profile" };

export default async function CandidateProfilePage() {
  const user = await requireCandidate();
  const admin = createAdminClient();

  const [profile, locations, portfolio] = await Promise.all([
    getOrCreateCandidateProfile(user.id),
    getLocations(),
    readPortfolioEntries(),
  ]);

  const [
    { data: education },
    { data: experience },
    { data: skills },
    { data: certifications },
    { count: skillsCount },
    { data: cvDocs },
    { count: applicationsCount },
    { count: savedJobsCount },
    accountResult,
  ] = await Promise.all([
    admin.from("candidate_education").select("*").eq("profile_id", profile.id).order("start_year", { ascending: false, nullsFirst: false }),
    admin.from("candidate_experience").select("*").eq("profile_id", profile.id).order("start_date", { ascending: false }),
    admin.from("candidate_skills").select("*").eq("profile_id", profile.id).order("skill"),
    admin.from("candidate_certifications").select("*").eq("profile_id", profile.id).order("issued_date", { ascending: false, nullsFirst: false }),
    admin.from("candidate_skills").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
    admin.from("candidate_documents").select("id").eq("profile_id", profile.id).eq("kind", "cv").eq("is_current_cv", true).limit(1),
    admin.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    admin.from("saved_jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    // profile_public arrives with migration 0015; the query errors until
    // then and the toggle renders in its "being set up" state (fail soft).
    admin.from("profiles").select("profile_public").eq("id", user.id).maybeSingle(),
  ]);

  const completion = computeProfileCompletion({
    profile,
    educationCount: (education ?? []).length,
    experienceCount: (experience ?? []).length,
    skillsCount: skillsCount ?? 0,
    hasCurrentCv: (cvDocs?.length ?? 0) > 0,
  });

  return (
    <main>
      <h1 className="text-2xl font-bold tracking-tight">My profile</h1>
      <p className="mt-1 text-sm text-slate-600">
        This is what employers see when you apply. We never ask for CNIC, date
        of birth, marital status, photo or religion for ordinary applications.
      </p>

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
          <Avatar name={profile.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-slate-900">{profile.full_name}</p>
            {profile.headline && <p className="text-sm text-slate-600">{profile.headline}</p>}
            <p className="mt-0.5 text-sm text-slate-500">
              {[profile.city, profile.province].filter(Boolean).join(", ") || "Location not set yet"}
              {(experience ?? []).length > 0 &&
                ` · ${(experience ?? []).length} role${(experience ?? []).length === 1 ? "" : "s"} of experience listed`}
            </p>
            {(skills ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(skills ?? []).slice(0, 8).map((s) => (
                  <Badge key={s.id as string} tone="neutral">
                    {s.skill as string}
                    {s.level ? ` · ${s.level as string}` : ""}
                  </Badge>
                ))}
                {(skills ?? []).length > 8 && (
                  <Badge tone="neutral">+{(skills ?? []).length - 8} more</Badge>
                )}
              </div>
            )}
          </div>
          <nav aria-label="Profile quick links" className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <Link href="/candidate/applications" className="rounded-md border border-slate-300 px-3 py-1.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
              My applications ({applicationsCount ?? 0})
            </Link>
            <Link href="/candidate/saved-jobs" className="rounded-md border border-slate-300 px-3 py-1.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
              Saved jobs ({savedJobsCount ?? 0})
            </Link>
            <Link href="/candidate/resume" className="rounded-md border border-slate-300 px-3 py-1.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
              My CV &amp; resume
            </Link>
            <Link href="/candidate/job-alerts" className="rounded-md border border-slate-300 px-3 py-1.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
              Job alerts
            </Link>
          </nav>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Public profile</CardTitle>
        </CardHeader>
        <CardContent>
          <PublicProfileToggle
            userId={user.id}
            initialPublic={accountResult.data?.profile_public === true}
            setupPending={Boolean(accountResult.error)}
          />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CVUploadCard hasCurrentCv={(cvDocs?.length ?? 0) > 0} />

          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactForm profile={profile} locations={locations} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Professional summary</CardTitle>
            </CardHeader>
            <CardContent>
              <SummaryForm profile={profile} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Education</CardTitle>
            </CardHeader>
            <CardContent>
              <EducationManager rows={(education ?? []) as EducationRow[]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work experience</CardTitle>
            </CardHeader>
            <CardContent>
              <ExperienceManager rows={(experience ?? []) as ExperienceRow[]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <SkillsManager rows={(skills ?? []) as SkillRow[]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Languages</CardTitle>
            </CardHeader>
            <CardContent>
              <LanguagesForm
                defaults={{
                  languages: portfolio.languages.map((l) => ({
                    language: l.language,
                    proficiency: l.proficiency,
                  })),
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Certifications</CardTitle>
            </CardHeader>
            <CardContent>
              <CertificationsManager rows={(certifications ?? []) as CertificationRow[]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Portfolio links</CardTitle>
            </CardHeader>
            <CardContent>
              <PortfolioForm
                defaults={{
                  links: portfolio.links.map((l) => ({ label: l.label ?? "", url: l.url })),
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employment preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <PreferencesForm profile={profile} />
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile strength</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div
                    className="relative h-16 w-16 shrink-0"
                    role="img"
                    aria-label={`Profile ${completion.percent}% complete`}
                  >
                    <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="#0f62c4"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${completion.percent}, 100`}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                      {completion.percent}%
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Complete profiles get shortlisted more often.
                  </p>
                </div>
                {completion.missing.length > 0 ? (
                  <ul className="mt-4 space-y-1.5">
                    {completion.missing.map((m) => (
                      <li key={m} className="flex items-start gap-2 text-sm text-slate-600">
                        <span aria-hidden="true" className="mt-0.5 text-amber-600">○</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Alert tone="success" className="mt-4">
                    Your profile is complete. Nice work!
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
