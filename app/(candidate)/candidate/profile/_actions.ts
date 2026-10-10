"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireCandidate,
  getOrCreateCandidateProfile,
  getCandidateProfile,
  type CandidateProfile,
} from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { zodFieldErrors } from "@/app/(candidate)/_components/form-helpers";
import {
  contactSchema,
  summarySchema,
  preferencesSchema,
  portfolioSchema,
  languagesSchema,
  educationSchema,
  experienceSchema,
  skillSchema,
  certificationSchema,
  type ContactInput,
  type SummaryInput,
  type PreferencesInput,
  type PortfolioInput,
  type LanguagesInput,
  type EducationInput,
  type ExperienceInput,
  type SkillInput,
  type CertificationInput,
} from "./_schemas";

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const okResult: ActionResult = { ok: true };

function fail(error: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, error, fieldErrors };
}

function zodErrors(err: z.ZodError): Record<string, string> {
  return zodFieldErrors(err);
}

async function ownProfile(): Promise<CandidateProfile> {
  const user = await requireCandidate();
  return getOrCreateCandidateProfile(user.id);
}

/** Verify a child row belongs to the candidate's profile; return profile. */
async function requireOwnedRow(
  table: "candidate_education" | "candidate_experience" | "candidate_skills" | "candidate_certifications",
  rowId: string,
): Promise<CandidateProfile> {
  const profile = await ownProfile();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(table)
    .select("id,profile_id")
    .eq("id", rowId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load record: ${error.message}`);
  const row = data as { id: string; profile_id: string } | null;
  if (!row || row.profile_id !== profile.id) {
    throw new Error("Record not found.");
  }
  return profile;
}

async function validateCityProvince(
  city: string | undefined,
  province: string | undefined,
): Promise<{ city: string | null; province: string | null } | { error: string }> {
  const trimmedCity = city?.trim() ?? "";
  if (!trimmedCity) return { city: null, province: null };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("locations")
    .select("city,province")
    .ilike("city", trimmedCity)
    .limit(1);
  if (error) throw new Error(`Failed to validate city: ${error.message}`);
  const match = (data?.[0] ?? null) as { city: string; province: string } | null;
  if (!match) {
    return { error: "Choose a city from the list." };
  }
  const trimmedProvince = province?.trim() ?? "";
  if (trimmedProvince && trimmedProvince !== match.province) {
    return { error: `${match.city} is in ${match.province}.` };
  }
  return { city: match.city, province: match.province };
}

// ─── Contact ────────────────────────────────────────────────────────────────

export async function updateContact(input: ContactInput): Promise<ActionResult> {
  try {
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const profile = await ownProfile();

    const phone = normalizePhone(parsed.data.phone ?? "");
    if (!phone.valid) {
      return fail("Please fix the highlighted fields.", { phone: phone.error ?? "Invalid phone number." });
    }
    const location = await validateCityProvince(parsed.data.city, parsed.data.province);
    if ("error" in location) {
      return fail("Please fix the highlighted fields.", { city: location.error });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("candidate_profiles")
      .update({
        full_name: parsed.data.full_name.trim(),
        headline: parsed.data.headline?.trim() || null,
        phone: phone.normalized,
        city: location.city,
        province: location.province,
      })
      .eq("id", profile.id);
    if (error) throw new Error(`Failed to save contact details: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save contact details.");
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────

export async function updateSummary(input: SummaryInput): Promise<ActionResult> {
  try {
    const parsed = summarySchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const profile = await ownProfile();
    const admin = createAdminClient();
    const { error } = await admin
      .from("candidate_profiles")
      .update({ summary: parsed.data.summary?.trim() || null })
      .eq("id", profile.id);
    if (error) throw new Error(`Failed to save summary: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save summary.");
  }
}

// ─── Preferences ────────────────────────────────────────────────────────────

export async function updatePreferences(input: PreferencesInput): Promise<ActionResult> {
  try {
    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const profile = await ownProfile();
    const admin = createAdminClient();
    const { error } = await admin
      .from("candidate_profiles")
      .update({
        availability: parsed.data.availability || null,
        expected_salary: parsed.data.expected_salary ?? null,
        notice_period_days: parsed.data.notice_period_days ?? null,
        is_searchable: parsed.data.is_searchable,
      })
      .eq("id", profile.id);
    if (error) throw new Error(`Failed to save preferences: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save preferences.");
  }
}

// ─── Portfolio links + languages (shared jsonb column) ──────────────────────
// Convention (documented): candidate_profiles.portfolio_links is an array of
//   { kind: "link", label, url }        — portfolio / website links
//   { kind: "language", language, proficiency } — spoken/written languages
// Plain-string entries are treated as legacy links.

interface LinkEntry {
  kind: "link";
  label: string | null;
  url: string;
}
interface LanguageEntry {
  kind: "language";
  language: string;
  proficiency: string;
}

function readPortfolio(raw: unknown): { links: LinkEntry[]; languages: LanguageEntry[] } {
  const links: LinkEntry[] = [];
  const languages: LanguageEntry[] = [];
  if (!Array.isArray(raw)) return { links, languages };
  for (const item of raw) {
    if (typeof item === "string") {
      if (item.trim()) links.push({ kind: "link", label: null, url: item.trim() });
      continue;
    }
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (rec.kind === "language" && typeof rec.language === "string") {
      languages.push({
        kind: "language",
        language: rec.language,
        proficiency: typeof rec.proficiency === "string" ? rec.proficiency : "Conversational",
      });
    } else if (typeof rec.url === "string" && rec.url.trim()) {
      links.push({
        kind: "link",
        label: typeof rec.label === "string" ? rec.label : null,
        url: rec.url.trim(),
      });
    }
  }
  return { links, languages };
}

async function writePortfolio(
  profile: CandidateProfile,
  links: LinkEntry[],
  languages: LanguageEntry[],
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("candidate_profiles")
    .update({ portfolio_links: [...links, ...languages] })
    .eq("id", profile.id);
  if (error) throw new Error(`Failed to save: ${error.message}`);
}

export async function updatePortfolio(input: PortfolioInput): Promise<ActionResult> {
  try {
    const parsed = portfolioSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const profile = await ownProfile();
    const existing = readPortfolio(profile.portfolio_links);
    await writePortfolio(
      profile,
      parsed.data.links.map((l) => ({
        kind: "link" as const,
        label: l.label?.trim() || null,
        url: l.url.trim(),
      })),
      existing.languages,
    );
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save portfolio links.");
  }
}

export async function updateLanguages(input: LanguagesInput): Promise<ActionResult> {
  try {
    const parsed = languagesSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const profile = await ownProfile();
    const existing = readPortfolio(profile.portfolio_links);
    await writePortfolio(
      profile,
      existing.links,
      parsed.data.languages.map((l) => ({
        kind: "language" as const,
        language: l.language.trim(),
        proficiency: l.proficiency,
      })),
    );
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save languages.");
  }
}

export async function readPortfolioEntries(): Promise<{
  links: LinkEntry[];
  languages: LanguageEntry[];
}> {
  const user = await requireCandidate();
  const profile = await getCandidateProfile(user.id);
  return readPortfolio(profile?.portfolio_links);
}

// ─── Education ──────────────────────────────────────────────────────────────

export async function saveEducation(
  rowId: string | null,
  input: EducationInput,
): Promise<ActionResult> {
  try {
    const parsed = educationSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const profile = await ownProfile();
    if (rowId) await requireOwnedRow("candidate_education", rowId);
    const admin = createAdminClient();
    const payload = {
      profile_id: profile.id,
      institution: parsed.data.institution.trim(),
      degree: parsed.data.degree.trim(),
      field: parsed.data.field?.trim() || null,
      start_year: parsed.data.start_year ?? null,
      end_year: parsed.data.is_current ? null : (parsed.data.end_year ?? null),
      is_current: parsed.data.is_current,
    };
    const { error } = rowId
      ? await admin.from("candidate_education").update(payload).eq("id", rowId)
      : await admin.from("candidate_education").insert(payload);
    if (error) throw new Error(`Failed to save education: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save education.");
  }
}

export async function deleteEducation(rowId: string): Promise<ActionResult> {
  try {
    await requireOwnedRow("candidate_education", rowId);
    const admin = createAdminClient();
    const { error } = await admin.from("candidate_education").delete().eq("id", rowId);
    if (error) throw new Error(`Failed to delete education: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to delete education.");
  }
}

// ─── Experience ─────────────────────────────────────────────────────────────

export async function saveExperience(
  rowId: string | null,
  input: ExperienceInput,
): Promise<ActionResult> {
  try {
    const parsed = experienceSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const profile = await ownProfile();
    if (rowId) await requireOwnedRow("candidate_experience", rowId);
    const admin = createAdminClient();
    const payload = {
      profile_id: profile.id,
      employer: parsed.data.employer.trim(),
      title: parsed.data.title.trim(),
      start_date: parsed.data.start_date,
      end_date: parsed.data.is_current ? null : (parsed.data.end_date ?? null),
      is_current: parsed.data.is_current,
      description: parsed.data.description?.trim() || null,
    };
    const { error } = rowId
      ? await admin.from("candidate_experience").update(payload).eq("id", rowId)
      : await admin.from("candidate_experience").insert(payload);
    if (error) throw new Error(`Failed to save experience: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save experience.");
  }
}

export async function deleteExperience(rowId: string): Promise<ActionResult> {
  try {
    await requireOwnedRow("candidate_experience", rowId);
    const admin = createAdminClient();
    const { error } = await admin.from("candidate_experience").delete().eq("id", rowId);
    if (error) throw new Error(`Failed to delete experience: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to delete experience.");
  }
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export async function addSkill(input: SkillInput): Promise<ActionResult> {
  try {
    const parsed = skillSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const profile = await ownProfile();
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("candidate_skills")
      .select("id")
      .eq("profile_id", profile.id)
      .ilike("skill", parsed.data.skill.trim())
      .limit(1);
    if (existing && existing.length > 0) {
      return fail("That skill is already on your profile.");
    }
    const { error } = await admin.from("candidate_skills").insert({
      profile_id: profile.id,
      skill: parsed.data.skill.trim(),
      years: parsed.data.years ?? null,
    });
    if (error) throw new Error(`Failed to add skill: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to add skill.");
  }
}

export async function deleteSkill(rowId: string): Promise<ActionResult> {
  try {
    await requireOwnedRow("candidate_skills", rowId);
    const admin = createAdminClient();
    const { error } = await admin.from("candidate_skills").delete().eq("id", rowId);
    if (error) throw new Error(`Failed to delete skill: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to delete skill.");
  }
}

// ─── Certifications ─────────────────────────────────────────────────────────

export async function saveCertification(
  rowId: string | null,
  input: CertificationInput,
): Promise<ActionResult> {
  try {
    const parsed = certificationSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const profile = await ownProfile();
    if (rowId) await requireOwnedRow("candidate_certifications", rowId);
    const admin = createAdminClient();
    const payload = {
      profile_id: profile.id,
      name: parsed.data.name.trim(),
      issuer: parsed.data.issuer?.trim() || null,
      issued_date: parsed.data.issued_date ?? null,
      credential_url: parsed.data.credential_url?.trim() || null,
    };
    const { error } = rowId
      ? await admin.from("candidate_certifications").update(payload).eq("id", rowId)
      : await admin.from("candidate_certifications").insert(payload);
    if (error) throw new Error(`Failed to save certification: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save certification.");
  }
}

export async function deleteCertification(rowId: string): Promise<ActionResult> {
  try {
    await requireOwnedRow("candidate_certifications", rowId);
    const admin = createAdminClient();
    const { error } = await admin.from("candidate_certifications").delete().eq("id", rowId);
    if (error) throw new Error(`Failed to delete certification: ${error.message}`);
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return okResult;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to delete certification.");
  }
}
