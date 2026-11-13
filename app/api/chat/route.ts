import { NextResponse } from "next/server";
import { askGroq, type ChatHistoryTurn } from "@/lib/chatbot/ai";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/chat — Groq AI fallback for the TalentBridge Assistant.
 *
 * The knowledge base answers site questions entirely client-side; this
 * route is called ONLY when the knowledge-base matcher fell back (an
 * unrelated question). It never sees site questions, and it fails soft:
 * with no GROQ_API_KEY configured it reports { mode: "disabled" } and the
 * widget shows the ordinary fallback. The API key is server-only and is
 * never exposed to the client or logged.
 */

const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_TURNS = 6;

type ChatMode =
  | { mode: "answer"; text: string }
  | { mode: "handover" }
  | { mode: "unavailable" }
  | { mode: "disabled" }
  | { mode: "rate_limited" };

function parseHistory(value: unknown): ChatHistoryTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: ChatHistoryTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { role, text } = item as { role?: unknown; text?: unknown };
    if (
      (role === "user" || role === "assistant") &&
      typeof text === "string" &&
      text.trim().length > 0
    ) {
      turns.push({ role, text: text.slice(0, MAX_MESSAGE_CHARS) });
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = (body as { message?: unknown } | null)?.message;
  if (
    typeof message !== "string" ||
    message.trim().length === 0 ||
    message.length > MAX_MESSAGE_CHARS
  ) {
    return NextResponse.json(
      { error: "A non-empty message (max 1000 characters) is required." },
      { status: 400 },
    );
  }
  const history = parseHistory((body as { history?: unknown }).history);

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ mode: "disabled" } satisfies ChatMode);
  }

  const { allowed } = await checkRateLimit(
    "chat_ai",
    getClientIp(req.headers),
    15,
    3600,
  );
  if (!allowed) {
    return NextResponse.json({ mode: "rate_limited" } satisfies ChatMode);
  }

  const result = await askGroq(message.trim(), history);
  if (result.type === "answer") {
    return NextResponse.json({
      mode: "answer",
      text: result.text,
    } satisfies ChatMode);
  }
  if (result.type === "handover") {
    return NextResponse.json({ mode: "handover" } satisfies ChatMode);
  }
  return NextResponse.json({ mode: "unavailable" } satisfies ChatMode);
}
