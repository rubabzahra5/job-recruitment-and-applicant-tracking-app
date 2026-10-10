import type { Metadata } from "next";
import {
  requireCandidate,
  getOrCreateCandidateProfile,
  getLocations,
} from "@/app/(candidate)/_lib/candidate-guard";
import { computeProfileCompletion } from "@/app/(candidate)/_lib/profile-completion";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
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
  ] = await Promise.all([
    admin.from("candidate_education").select("*").eq("profile_id", profile.id).order("start_year", { ascending: false, nullsFirst: false }),
    admin.from("candidate_experience").select("*").eq("profile_id", profile.id).order("start_date", { ascending: false }),
    admin.from("candidate_skills").select("*").eq("profile_id", profile.id).order("skill"),
    admin.from("candidate_certifications").select("*").eq("profile_id", profile.id).order("issued_date", { ascending: false, nullsFirst: false }),
    admin.from("candidate_skills").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
    admin.from("candidate_documents").select("id").eq("profile_id", profile.id).eq("kind", "cv").eq("is_current_cv", true).limit(1),
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

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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
                        <span aria-hidden="true" className="mt-0.5 text-amber-500">○</span>
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
