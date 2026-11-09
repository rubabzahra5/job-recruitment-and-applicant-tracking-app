"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircle, Send, X } from "lucide-react";
import { CHAT_SUGGESTIONS, type ChatLink } from "@/lib/chatbot/knowledge";
import { matchQuestion, relatedEntries } from "@/lib/chatbot/matcher";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  links?: ChatLink[];
}

const WELCOME: ChatMessage = {
  role: "assistant",
  text: "Assalam-o-Alaikum! I'm the TalentBridge Assistant. Ask me about finding jobs, applying, posting a job, your account — or our promise that companies respond within 5–7 business days.",
};

/**
 * Site-wide, rule-based help chat. Fully client-side: it matches questions
 * against the local knowledge base (lib/chatbot) — no external AI service,
 * in line with TalentBridge's free-tier rule. Unknown questions get a
 * friendly fallback pointing at /faq and /contact, never an invented answer.
 */
export function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<string[]>(CHAT_SUGGESTIONS);
  const logRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open ]);

  const ask = React.useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const match = matchQuestion(text);
    const reply: ChatMessage = match.isFallback
      ? { role: "assistant", text: match.fallbackText, links: match.fallbackLinks }
      : {
          role: "assistant",
          text: match.entry!.answer,
          links: match.entry!.links,
        };
    setMessages((prev) => [...prev, { role: "user", text }, reply]);
    setSuggestions(
      !match.isFallback && match.entry
        ? relatedEntries(match.entry).map((e) => e.question)
        : CHAT_SUGGESTIONS,
    );
    setInput("");
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
                  }`}
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
                disabled={!input.trim()}
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
