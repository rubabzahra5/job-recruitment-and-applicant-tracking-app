"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircle, Send, X } from "lucide-react";
import { CHAT_SUGGESTIONS, type ChatLink } from "@/lib/chatbot/knowledge";
import { matchQuestion, relatedEntries } from "@/lib/chatbot/matcher";
import {
  detectHumanIntent,
  HANDOVER_LINKS,
  HANDOVER_TEXT,
} from "@/lib/chatbot/ai";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  links?: ChatLink[];
  /** True for the temporary "thinking" bubble while /api/chat responds. */
  pending?: boolean;
}

const WELCOME: ChatMessage = {
  role: "assistant",
  text: "Assalam-o-Alaikum! I'm the TalentBridge Assistant. Ask me about finding jobs, applying, posting a job, your account — or our promise that companies respond within 5–7 business days.",
};

/**
 * Site-wide help chat for the TalentBridge Assistant.
 *
 * Fallback chain:
 * 1. A direct request for a human ("talk to a human", "customer support"…)
 *    hands over immediately — no matching, no server call.
 * 2. Site questions are matched against the local knowledge base
 *    (lib/chatbot) — fully client-side, no external service, in line with
 *    TalentBridge's free-tier rule.
 * 3. Only when the knowledge base falls back (an unrelated question) does
 *    the widget ask the server route /api/chat, which may answer via Groq
 *    AI or signal a human handover. If that route is disabled,
 *    rate-limited or unavailable, the widget shows exactly the classic
 *    fallback pointing at /faq and /contact — never an invented answer.
 */
export function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<string[]>(CHAT_SUGGESTIONS);
  const [busy, setBusy] = React.useState(false);
  const logRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const messagesRef = React.useRef(messages);
  const busyRef = React.useRef(false);

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open ]);

  const ask = React.useCallback((raw: string) => {
    const text = raw.trim();
    if (!text || busyRef.current) return;

    // 1. A direct request for a human hands over immediately.
    if (detectHumanIntent(text)) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text },
        { role: "assistant", text: HANDOVER_TEXT, links: HANDOVER_LINKS },
      ]);
      setSuggestions(CHAT_SUGGESTIONS);
      setInput("");
      return;
    }

    const match = matchQuestion(text);

    // 2. Knowledge-base hit — unchanged, fully client-side.
    if (!match.isFallback && match.entry) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text },
        {
          role: "assistant",
          text: match.entry!.answer,
          links: match.entry!.links,
        },
      ]);
      setSuggestions(relatedEntries(match.entry).map((e) => e.question));
      setInput("");
      return;
    }

    // 3. Knowledge-base fallback (unrelated question): ask /api/chat,
    //    which may answer with Groq AI. Every non-answer outcome resolves
    //    to exactly the classic fallback reply.
    const fallbackReply: ChatMessage = {
      role: "assistant",
      text: match.fallbackText,
      links: match.fallbackLinks,
    };
    const history = messagesRef.current
      .filter((m) => !m.pending)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    busyRef.current = true;
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "assistant", text: "Thinking…", pending: true },
    ]);
    setSuggestions(CHAT_SUGGESTIONS);
    setInput("");

    const resolve = (reply: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.pending ? reply : m)));
      busyRef.current = false;
      setBusy(false);
    };

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          mode?: string;
          text?: unknown;
        } | null;
        if (
          data?.mode === "answer" &&
          typeof data.text === "string" &&
          data.text.trim()
        ) {
          resolve({ role: "assistant", text: data.text });
        } else if (data?.mode === "handover") {
          resolve({
            role: "assistant",
            text: HANDOVER_TEXT,
            links: HANDOVER_LINKS,
          });
        } else {
          // disabled | unavailable | rate_limited | unexpected shape
          resolve(fallbackReply);
        }
      })
      .catch(() => resolve(fallbackReply));
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          role="dialog"
          aria-label="TalentBridge Assistant chat"
          className="flex h-[32rem] max-h-[75vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between bg-brand-900 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">TalentBridge Assistant</p>
              <p className="text-xs text-brand-100">Free help, no sign-up needed</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-md p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div ref={logRef} role="log" aria-live="polite" aria-label="Chat messages" className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-brand-700 text-white"
                      : "rounded-bl-md bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
                  }${m.pending ? " animate-pulse text-slate-400" : ""}`}
                >
                  <p>{m.text}</p>
                  {m.links && m.links.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <Link
                          key={l.href + l.label}
                          href={l.href}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 ${
                            m.role === "user"
                              ? "bg-white/15 text-white focus-visible:ring-white"
                              : "bg-brand-50 text-brand-700 focus-visible:ring-brand-500"
                          }`}
                        >
                          {l.label}
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 bg-white px-3 pt-2">
            <div className="flex flex-wrap gap-1.5" aria-label="Suggested questions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <label htmlFor="tb-chat-input" className="sr-only">
                Ask the TalentBridge Assistant a question
              </label>
              <input
                id="tb-chat-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="Ask about jobs, applying, fees…"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-full border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={!input.trim() || busy}
                className="shrink-0 rounded-full bg-brand-700 p-2.5 text-white transition hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close TalentBridge Assistant chat" : "Open TalentBridge Assistant chat"}
        className="flex items-center gap-2 rounded-full bg-brand-900 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <MessageCircle className="h-5 w-5" aria-hidden="true" />}
        {open ? "Close" : "Ask TalentBridge"}
      </button>
    </div>
  );
}
