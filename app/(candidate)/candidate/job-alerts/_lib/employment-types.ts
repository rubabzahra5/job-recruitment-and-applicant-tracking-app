// Shared employment-type options. Plain module (no "use server") so it can be
// imported by both server actions and client components.
export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "temporary",
  "internship",
  "apprenticeship",
  "freelance",
] as const;
