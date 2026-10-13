/**
 * Cover-letter similarity detection (no AI API).
 * 
 * Uses Jaccard similarity on word shingles to detect when a candidate
 * submits nearly-identical cover letters across multiple applications
 * (a signal of mass AI-generated applications).
 * 
 * This is a heuristic, not a verdict. High similarity suggests the candidate
 * is using a template; it doesn't prove AI generation.
 */

/**
 * Normalize text: lowercase, remove punctuation, collapse whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, " ") // keep Urdu/Arabic script
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate word shingles (n-grams) from text.
 */
function shingles(text: string, n = 3): Set<string> {
  const words = normalize(text).split(" ").filter(w => w.length > 0);
  const result = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    result.add(words.slice(i, i + n).join(" "));
  }
  return result;
}

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|
 * Returns 0 (completely different) to 1 (identical).
 */
export function jaccardSimilarity(text1: string, text2: string, shingleSize = 3): number {
  if (!text1.trim() || !text2.trim()) return 0;
  
  const s1 = shingles(text1, shingleSize);
  const s2 = shingles(text2, shingleSize);
  
  if (s1.size === 0 || s2.size === 0) return 0;
  
  let intersection = 0;
  for (const s of s1) {
    if (s2.has(s)) intersection++;
  }
  
  const union = s1.size + s2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Check a new cover letter against a candidate's previous ones.
 * Returns the highest similarity score and the matching application ID.
 */
export function checkSimilarity(
  newLetter: string,
  previousLetters: Array<{ applicationId: string; coverLetter: string }>,
): { maxSimilarity: number; matchedApplicationId: string | null } {
  let maxSimilarity = 0;
  let matchedId: string | null = null;
  
  for (const prev of previousLetters) {
    const sim = jaccardSimilarity(newLetter, prev.coverLetter);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      matchedId = prev.applicationId;
    }
  }
  
  return { maxSimilarity, matchedApplicationId: matchedId };
}

/**
 * Interpret a similarity score for UI display.
 */
export function similarityLabel(score: number): { label: string; tone: "success" | "warning" | "danger" } {
  if (score >= 0.8) return { label: "Nearly identical to a previous application", tone: "danger" };
  if (score >= 0.5) return { label: "Very similar to a previous application", tone: "warning" };
  if (score >= 0.3) return { label: "Somewhat similar to a previous application", tone: "warning" };
  return { label: "Original content", tone: "success" };
}
