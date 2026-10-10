import { z } from "zod";

/**
 * Zod schemas for candidate profile forms.
 * Plain TS (no "use client"): imported by both client components
 * (via zodResolver) and server actions.
 */

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const contactSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(120),
  headline: z
    .string()
    .trim()
    .max(160, "Headline must be 160 characters or less.")
    .optional(),
  phone: z.string().trim().max(32).optional(),
  city: z.string().trim().max(80).optional(),
  province: z.string().trim().max(80).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const summarySchema = z.object({
  summary: z
    .string()
    .trim()
    .max(2000, "Summary must be 2000 characters or less.")
    .optional(),
});
export type SummaryInput = z.infer<typeof summarySchema>;

export const AVAILABILITY_OPTIONS = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Freelance",
  "Open to all",
] as const;

export const preferencesSchema = z.object({
  availability: z.enum(AVAILABILITY_OPTIONS).optional().or(z.literal("")),
  expected_salary: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int("Expected salary must be a whole number.")
      .min(0, "Expected salary cannot be negative.")
      .max(100_000_000, "Expected salary looks too high.")
      .optional(),
  ),
  notice_period_days: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int("Notice period must be a whole number of days.")
      .min(0, "Notice period cannot be negative.")
      .max(365, "Notice period cannot exceed 365 days.")
      .optional(),
  ),
  is_searchable: z.boolean(),
});
export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const portfolioLinkSchema = z.object({
  label: z.string().trim().max(80).optional(),
  url: z.string().trim().url("Enter a valid URL (include https://).").max(500),
});

export const portfolioSchema = z.object({
  links: z.array(portfolioLinkSchema).max(10, "At most 10 links."),
});
export type PortfolioInput = z.infer<typeof portfolioSchema>;

export const PROFICIENCY_OPTIONS = [
  "Basic",
  "Conversational",
  "Fluent",
  "Native",
] as const;

export const languageSchema = z.object({
  language: z.string().trim().min(2, "Enter a language.").max(60),
  proficiency: z.enum(PROFICIENCY_OPTIONS),
});

export const languagesSchema = z.object({
  languages: z.array(languageSchema).max(10, "At most 10 languages."),
});
export type LanguagesInput = z.infer<typeof languagesSchema>;

const currentYear = new Date().getFullYear();

export const educationSchema = z
  .object({
    institution: z.string().trim().min(2, "Enter the institution name.").max(160),
    degree: z.string().trim().min(2, "Enter the degree.").max(160),
    field: z.string().trim().max(120).optional(),
    start_year: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number()
        .int()
        .min(1950, "Start year looks too old.")
        .max(currentYear, "Start year cannot be in the future.")
        .optional(),
    ),
    end_year: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number()
        .int()
        .min(1950, "End year looks too old.")
        .max(currentYear + 6, "End year looks too far ahead.")
        .optional(),
    ),
    is_current: z.boolean(),
  })
  .refine(
    (v) => v.is_current || v.end_year == null || v.start_year == null || v.end_year >= v.start_year,
    { message: "End year must be after start year.", path: ["end_year"] },
  );
export type EducationInput = z.infer<typeof educationSchema>;

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");

export const experienceSchema = z
  .object({
    employer: z.string().trim().min(2, "Enter the employer name.").max(160),
    title: z.string().trim().min(2, "Enter your job title.").max(160),
    start_date: dateString,
    end_date: z.preprocess(emptyToUndefined, dateString.optional()),
    is_current: z.boolean(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.start_date <= new Date().toISOString().slice(0, 10), {
    message: "Start date cannot be in the future.",
    path: ["start_date"],
  })
  .refine(
    (v) =>
      v.is_current || !v.end_date || v.end_date >= v.start_date,
    { message: "End date must be after start date.", path: ["end_date"] },
  );
export type ExperienceInput = z.infer<typeof experienceSchema>;

export const skillSchema = z.object({
  skill: z.string().trim().min(1, "Enter a skill.").max(80),
  years: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .min(0, "Years cannot be negative.")
      .max(60, "Years looks too high.")
      .optional(),
  ),
});
export type SkillInput = z.infer<typeof skillSchema>;

export const certificationSchema = z.object({
  name: z.string().trim().min(2, "Enter the certification name.").max(160),
  issuer: z.string().trim().max(160).optional(),
  issued_date: z.preprocess(
    emptyToUndefined,
    dateString
      .refine((d) => d <= new Date().toISOString().slice(0, 10), {
        message: "Issued date cannot be in the future.",
      })
      .optional(),
  ),
  credential_url: z
    .preprocess(emptyToUndefined, z.string().trim().url("Enter a valid URL.").max(500).optional()),
});
export type CertificationInput = z.infer<typeof certificationSchema>;
