/**
 * Structured rating rubric criteria (shared by the server action that
 * persists rubrics and the client form that renders them).
 * Kept out of "use server" modules, which may only export async functions.
 */

export const RUBRIC_CRITERIA = [
  { key: "skills_match", label: "Skills match" },
  { key: "experience_relevance", label: "Experience relevance" },
  { key: "communication", label: "Communication" },
  { key: "cultural_fit", label: "Cultural fit" },
  { key: "overall", label: "Overall impression" },
] as const;

export type RubricCriterionKey = (typeof RUBRIC_CRITERIA)[number]["key"];
