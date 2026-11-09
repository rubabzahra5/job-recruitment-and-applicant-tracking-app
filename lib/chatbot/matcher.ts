import {
  CHAT_FALLBACK,
  KNOWLEDGE,
  type KnowledgeEntry,
} from "./knowledge";

/**
 * Rule-based intent matcher for the TalentBridge Assistant.
 *
 * Scoring: the question is normalized (lowercase, punctuation stripped)
 * and compared against each entry's keywords. Multi-word keyword phrases
 * score by word count squared (specific phrases beat generic words),
 * single keywords score 2. The `question` field's words add a small
 * overlap bonus. Below a minimum score we return the friendly fallback
 * instead of guessing.
 */

export interface ChatMatch {
  entry: KnowledgeEntry | null;
  score: number;
  /** True when no entry scored high enough — use the fallback text. */
  isFallback: boolean;
  fallbackText: string;
  fallbackLinks: { label: string; href: string }[];
}

const MIN_SCORE = 2;

const FALLBACK_LINKS = [
  { label: "Read the FAQ", href: "/faq" },
  { label: "Contact support", href: "/contact" },
];

export function normalizeQuestion(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreEntry(normalized: string, entry: KnowledgeEntry): number {
  let score = 0;
  const padded = ` ${normalized} `;
  for (const kw of entry.keywords) {
    const needle = normalizeQuestion(kw);
    if (!needle) continue;
    if (needle.includes(" ")) {
      if (padded.includes(` ${needle} `) || normalized === needle) {
        score += needle.split(" ").length * needle.split(" ").length;
      }
    } else if (padded.includes(` ${needle} `)) {
      // Single distinctive keywords carry an intent on their own
      // ("hello", "apply", "free"), so they meet the threshold alone.
      score += 2;
    }
  }
  if (score === 0) return 0;
  // Small bonus for word overlap with the canonical question.
  const qWords = new Set(normalizeQuestion(entry.question).split(" "));
  for (const w of normalized.split(" ")) {
    if (w.length > 3 && qWords.has(w)) score += 0.25;
  }
  return score;
}

export function matchQuestion(raw: string): ChatMatch {
  const fallback: ChatMatch = {
    entry: null,
    score: 0,
    isFallback: true,
    fallbackText: CHAT_FALLBACK,
    fallbackLinks: FALLBACK_LINKS,
  };
  const normalized = normalizeQuestion(raw ?? "");
  if (!normalized) return fallback;

  let best: KnowledgeEntry | null = null;
  let bestScore = 0;
  for (const entry of KNOWLEDGE) {
    const s = scoreEntry(normalized, entry);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }

  if (!best || bestScore < MIN_SCORE) {
    return { ...fallback, score: bestScore };
  }
  return {
    entry: best,
    score: bestScore,
    isFallback: false,
    fallbackText: CHAT_FALLBACK,
    fallbackLinks: FALLBACK_LINKS,
  };
}

/**
 * Related follow-up suggestions: other entries sharing keywords with the
 * matched one, so the widget can offer "You may also ask…".
 */
export function relatedEntries(entry: KnowledgeEntry, limit = 3): KnowledgeEntry[] {
  const words = new Set(entry.keywords.flatMap((k) => normalizeQuestion(k).split(" ")));
  return KNOWLEDGE.filter((e) => e.id !== entry.id)
    .map((e) => ({
      e,
      overlap: e.keywords.flatMap((k) => normalizeQuestion(k).split(" ")).filter((w) => words.has(w)).length,
    }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((x) => x.e);
}
