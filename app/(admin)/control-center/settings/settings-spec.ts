/**
 * Platform settings specification.
 *
 * Each entry documents where the setting is consumed. IMPORTANT (verified
 * 2026-10-10): no route code reads `platform_settings` yet — the employer,
 * candidate and public agents are building those code paths concurrently.
 * The "consumed by" notes below are the CONTRACT those agents should honor;
 * see MODULE_SUMMARY_D.md for the verification status of each key.
 */
export interface SettingSpec {
  key: string;
  label: string;
  type: "string" | "boolean" | "number" | "select";
  options?: string[];
  description: string;
  consumedBy: string;
}

export const SETTING_SPECS: SettingSpec[] = [
  {
    key: "platform_name",
    label: "Platform name / brand",
    type: "string",
    description: "Display brand name. Temporary and configurable by design.",
    consumedBy: "Public header/footer, email templates, page titles.",
  },
  {
    key: "operating_mode",
    label: "Operating mode",
    type: "select",
    options: ["centralized", "internal"],
    description:
      "centralized = recruitment portal run by the platform owner (orgs register publicly, need verification). internal = single organization using the platform privately as its internal recruitment system.",
    consumedBy:
      "Employer onboarding + registration pages; public org directory visibility. CONTRACT — not yet read by any route (verified 2026-10-10).",
  },
  {
    key: "currency",
    label: "Currency",
    type: "string",
    description: "ISO currency code used for salary display.",
    consumedBy: "Salary formatting (lib/format.ts CURRENCY).",
  },
  {
    key: "timezone",
    label: "Display timezone",
    type: "string",
    description: "IANA timezone for displaying timestamps (stored in UTC).",
    consumedBy: "Interview scheduling + all date displays (lib/format.ts DISPLAY_TIMEZONE).",
  },
  {
    key: "registration_open",
    label: "Registration open",
    type: "boolean",
    description: "Whether new candidate/employer accounts can register.",
    consumedBy: "Auth registration pages (candidate + employer agents).",
  },
  {
    key: "employer_approval_required",
    label: "Employer approval required",
    type: "boolean",
    description:
      "When on, newly registered organizations enter verification_status=pending and wait in the Approvals queue.",
    consumedBy: "Employer registration flow. CONTRACT — not yet read by any route (verified 2026-10-10).",
  },
  {
    key: "job_moderation_required",
    label: "Job moderation required",
    type: "boolean",
    description:
      "When on, newly submitted jobs enter status=pending_review for the Approvals queue instead of publishing directly.",
    consumedBy: "Employer job posting flow; public listings only show approved/published jobs. CONTRACT — not yet read by any route (verified 2026-10-10).",
  },
  {
    key: "max_active_applications_per_candidate",
    label: "Max active applications per candidate",
    type: "number",
    description: "Cap on non-withdrawn applications per candidate.",
    consumedBy: "Candidate apply flow (enforced alongside the DB partial-unique index).",
  },
  {
    key: "cv_max_file_mb",
    label: "CV max file size (MB)",
    type: "number",
    description: "Maximum CV upload size in megabytes.",
    consumedBy: "CV uploads (lib/uploads.ts default 10MB cap).",
  },
  {
    key: "cv_allowed_types",
    label: "CV allowed file types",
    type: "string",
    description: "Comma-separated extensions, e.g. pdf,doc,docx.",
    consumedBy: "CV uploads (magic-byte + extension validation in lib/uploads.ts).",
  },
  {
    key: "data_retention_days",
    label: "Data retention (days)",
    type: "number",
    description: "How long candidate data is kept before retention processing.",
    consumedBy: "Privacy/retention jobs; candidates retention queue on this page group.",
  },
  {
    key: "notify_on_new_application",
    label: "Notify on new application",
    type: "boolean",
    description: "Default: notify org staff when a new application arrives.",
    consumedBy: "Application submission flow (lib/notifications.ts).",
  },
  {
    key: "notify_on_stage_change",
    label: "Notify on stage change",
    type: "boolean",
    description: "Default: notify candidates when their application stage changes.",
    consumedBy: "Stage-change flow (lib/notifications.ts).",
  },
  {
    key: "privacy_contact_email",
    label: "Privacy contact email",
    type: "string",
    description: "Contact shown for privacy requests and data-rights inquiries.",
    consumedBy: "Candidate privacy pages, consent records.",
  },
  {
    key: "support_email",
    label: "Public support email",
    type: "string",
    description: "Public contact email shown in footer/help.",
    consumedBy: "Public layout footer, contact page.",
  },
  {
    key: "support_phone",
    label: "Public support phone",
    type: "string",
    description: "Public contact phone shown in footer/help.",
    consumedBy: "Public layout footer, contact page.",
  },
];

export const DEFAULTS: Record<string, unknown> = {
  platform_name: "Job Recruitment And Applicant Tracking System",
  operating_mode: "centralized",
  currency: "PKR",
  timezone: "Asia/Karachi",
  registration_open: true,
  employer_approval_required: true,
  job_moderation_required: true,
  max_active_applications_per_candidate: 10,
  cv_max_file_mb: 10,
  cv_allowed_types: "pdf,doc,docx",
  data_retention_days: 365,
  notify_on_new_application: true,
  notify_on_stage_change: true,
  privacy_contact_email: "",
  support_email: "",
  support_phone: "",
};
