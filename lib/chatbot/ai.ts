import type { ChatLink } from "./knowledge";
import { normalizeQuestion } from "./matcher";

/**
 * Groq AI fallback for the TalentBridge Assistant — pure helpers, plus one
 * server-side call (askGroq).
 *
 * The knowledge base (matcher.ts) stays the primary brain: it answers every
 * site question. This module is only used when the matcher falls back (an
 * unrelated / off-topic question) and the visitor has not asked for a human.
 * Everything here fails safe: any problem (no key, timeout, bad response)
 * yields { type: "unavailable" } and the widget shows the ordinary
 * knowledge-base fallback instead.
 *
 * The constants and pure helpers are client-safe (the chat widget imports
 * them). askGroq is NOT: it reads the secret GROQ_API_KEY and must only be
 * called from server code (app/api/chat/route.ts). It is kept in this file
 * so the whole fallback contract lives in one place; never call it from a
 * client component.
 */

export interface ChatHistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export type GroqResult =
  | { type: "answer"; text: string }
  | { type: "handover" }
  | { type: "unavailable" };

/** Marker the model is instructed to reply with when a human is needed. */
export const HANDOVER_MARKER = "[[HANDOVER]]";

export const HANDOVER_TEXT =
  "This one needs a human from our team — I don't want to guess and give you the wrong answer. You can reach our support team through the contact page and they'll get back to you. If it's about jobs, applying or your account, you can also try asking me in a different way.";

export const HANDOVER_LINKS: ChatLink[] = [
  { label: "Contact support", href: "/contact" },
  { label: "Read the FAQ", href: "/faq" },
];

/**
 * Tight, phrase-level human-handover intents. Deliberately NOT single
 * generic words: "human resources jobs" must never trip this. Matching is
 * done on the normalized question with word boundaries.
 */
const HUMAN_INTENT_PHRASES = [
  "talk to a human",
  "speak to a human",
  "talk to human",
  "speak to human",
  "talk to a person",
  "speak to a person",
  "talk to someone",
  "speak to someone",
  "real person",
  "human agent",
  "contact a human",
  "need a human",
  "want a human",
  "human please",
  "agent please",
  "customer support",
  "customer service",
  "support team",
  "representative",
];

export function detectHumanIntent(text: string): boolean {
  const normalized = normalizeQuestion(text ?? "");
  if (!normalized) return false;
  const padded = ` ${normalized} `;
  return HUMAN_INTENT_PHRASES.some(
    (phrase) => padded.includes(` ${phrase} `) || normalized === phrase,
  );
}

const SYSTEM_PROMPT = [
  "You are the TalentBridge Assistant, the friendly helper on TalentBridge — a free job recruitment and applicant tracking platform built for Pakistan.",
  "The visitor's question is outside the site's own help topics, so answer it as a general question, briefly: 2 to 5 sentences, plain and friendly. Reply in the visitor's language style — if they write in English, answer in English; if they mix Urdu and English (Roman Urdu), you may mix the same way.",
  "Hard rules:",
  "- NEVER invent facts about TalentBridge: do not state anything about its jobs, companies, fees, policies, or the visitor's account or applications as if you knew them. If asked about TalentBridge specifics you do not know, do not guess.",
  `- If the question is about the visitor's own account, their application status, a specific job or company on the platform, a complaint, or anything that needs a human's judgment, reply with exactly ${HANDOVER_MARKER} and nothing else.`,
  "- Do not claim to be human. You are an AI assistant.",
].join("\n");

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Build the OpenAI-style messages array for Groq: the system prompt, at
 * most the last 6 history turns, then the visitor's new message.
 */
export function buildGroqMessages(
  message: string,
  history: ChatHistoryTurn[] = [],
): GroqMessage[] {
  const recent = history
    .filter(
      (t) =>
        (t.role === "user" || t.role === "assistant") &&
        typeof t.text === "string" &&
        t.text.trim().length > 0,
    )
    .slice(-6);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...recent.map((t) => ({ role: t.role, content: t.text })),
    { role: "user", content: message },
  ];
}

/**
 * Interpret the model's reply. A reply starting with the handover marker
 * (ignoring leading whitespace) means a human is needed — anything after
 * the marker is ignored. An empty reply means the AI gave us nothing
 * usable, reported as "unavailable" so the caller can fall back to the
 * standard knowledge-base fallback. Anything else is the answer text.
 */
export function parseGroqAnswer(raw: string): GroqResult {
  const text = (raw ?? "").trim();
  if (!text) return { type: "unavailable" };
  if (text.startsWith(HANDOVER_MARKER)) return { type: "handover" };
  return { type: "answer", text };
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TIMEOUT_MS = 10_000;

/**
 * Ask Groq to answer an off-topic question. SERVER ONLY: reads the API key
 * from the environment at call time and never exposes it (the key is a
 * non-public env var, so it is never inlined into client bundles). Returns
 * "unavailable" for a missing key, any HTTP error, a timeout, or a
 * malformed response — the caller then falls back gracefully.
 */
export async function askGroq(
  message: string,
  history: ChatHistoryTurn[] = [],
): Promise<GroqResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { type: "unavailable" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: buildGroqMessages(message, history),
        max_tokens: 450,
        temperature: 0.4,
      }),
    });
    if (!res.ok) return { type: "unavailable" };
    const data: unknown = await res.json();
    const content = (
      data as {
        choices?: { message?: { content?: unknown } }[];
      } | null
    )?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { type: "unavailable" };
    return parseGroqAnswer(content);
  } catch {
    return { type: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
