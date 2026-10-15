/**
 * format-label — single source of truth for human-readable labels.
 * Never render raw DB enum values (super_admin, possible_duplicate, …)
 * in the UI; always pass them through formatLabel().
 */

const LABELS: Record<string, string> = {
  // roles
  super_admin: "Super admin",
  org_admin: "Org admin",
  hr_manager: "HR manager",
  hiring_manager: "Hiring manager",
  recruiter: "Recruiter",
  candidate: "Candidate",
  employee: "Employee",
  // account status
  active: "Active",
  suspended: "Suspended",
  closed: "Closed",
  unverified: "Unverified",
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
  // verification / duplicates
  possible_duplicate: "Possible duplicate",
  phone_verified: "Phone verified",
  // pipeline stages
  applied: "Applied",
  screening: "Screening",
  shortlisted: "Shortlisted",
  interview: "Interview",
  interview_scheduled: "Interview scheduled",
  offer: "Offer",
  offer_extended: "Offer extended",
  hired: "Hired",
  withdrawn: "Withdrawn",
  declined: "Declined",
  // jobs
  draft: "Draft",
  published: "Published",
  paused: "Paused",
  // invitations
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
  // generic
  yes: "Yes",
  no: "No",
};

/**
 * Convert a snake_case / DB enum value to a human label.
 * Falls back to title-casing the raw value so nothing renders blank.
 */
export function formatLabel(value: string | null | undefined): string {
  if (value == null) return "—";
  const key = value.toLowerCase();
  if (LABELS[key]) return LABELS[key];
  return value
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
