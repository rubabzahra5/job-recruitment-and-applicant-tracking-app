import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  askGroq,
  buildGroqMessages,
  detectHumanIntent,
  HANDOVER_LINKS,
  HANDOVER_MARKER,
  parseGroqAnswer,
  type ChatHistoryTurn,
} from "@/lib/chatbot/ai";
import { matchQuestion } from "@/lib/chatbot/matcher";

describe("detectHumanIntent", () => {
  it("detects direct requests for a human", () => {
    const positives = [
      "Can I talk to a human?",
      "I want to speak to a human",
      "talk to human please",
      "Let me talk to a person",
      "I need a real person",
      "human agent please",
      "Can I contact a human?",
      "I need a human",
      "human please!",
      "agent please",
      "How do I reach customer support?",
      "Your customer service is not replying",
      "Please connect me to the support team",
      "Is there a representative I can talk to?",
      "SPEAK TO SOMEONE",
    ];
    for (const text of positives) {
      expect(detectHumanIntent(text), text).toBe(true);
    }
  });

  it("does not trigger on ordinary site questions", () => {
    const negatives = [
      "human resources jobs in Lahore",
      "How do I apply for a job?",
      "What is the response time rule?",
      "Are there any HR manager jobs?",
      "How do I contact a company about my application?",
      "What is TalentBridge?",
      "",
      "   ",
    ];
    for (const text of negatives) {
      expect(detectHumanIntent(text), text).toBe(false);
    }
  });

  it("handover links point at contact and FAQ", () => {
    expect(HANDOVER_LINKS.map((l) => l.href)).toEqual(["/contact", "/faq"]);
  });
});

describe("buildGroqMessages", () => {
  it("puts the system prompt first and the new message last", () => {
    const messages = buildGroqMessages("What is the capital of France?");
    expect(messages[0]!.role).toBe("system");
    expect(messages[0]!.content).toContain("TalentBridge");
    expect(messages[0]!.content).toContain(HANDOVER_MARKER);
    expect(messages[messages.length - 1]).toEqual({
      role: "user",
      content: "What is the capital of France?",
    });
  });

  it("caps history at the last 6 turns", () => {
    const history: ChatHistoryTurn[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      text: `turn ${i}`,
    }));
    const messages = buildGroqMessages("next question", history);
    // system + 6 history + new user message
    expect(messages).toHaveLength(8);
    expect(messages[1]!.content).toBe("turn 4");
    expect(messages[6]!.content).toBe("turn 9");
    expect(messages[7]).toEqual({ role: "user", content: "next question" });
  });

  it("skips blank or malformed history turns", () => {
    const history = [
      { role: "user", text: "  " },
      { role: "assistant", text: "a real answer" },
    ] as ChatHistoryTurn[];
    const messages = buildGroqMessages("hi", history);
    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual({ role: "assistant", content: "a real answer" });  });
});

describe("parseGroqAnswer", () => {
  it("treats a reply starting with the marker as a handover", () => {
    expect(parseGroqAnswer("[[HANDOVER]]")).toEqual({ type: "handover" });
    expect(parseGroqAnswer("[[HANDOVER]] please contact the team")).toEqual({
      type: "handover",
    });
  });

  it("ignores leading whitespace before the marker", () => {
    expect(parseGroqAnswer("   \n [[HANDOVER]]")).toEqual({
      type: "handover",
    });
  });

  it("returns normal text as an answer", () => {
    expect(parseGroqAnswer("The capital of France is Paris.")).toEqual({
      type: "answer",
      text: "The capital of France is Paris.",
    });
  });

  it("treats an empty reply as unavailable", () => {
    expect(parseGroqAnswer("")).toEqual({ type: "unavailable" });
    expect(parseGroqAnswer("   ")).toEqual({ type: "unavailable" });
  });
});

describe("askGroq (stubbed fetch)", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key-not-real";
    delete process.env.GROQ_MODEL;
    // Failed attempts log their failure class server-side; keep test
    // output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_MODEL;
    vi.restoreAllMocks();
  });

  function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
    const fn = vi.fn(impl as typeof fetch);
    globalThis.fetch = fn as typeof fetch;
    return fn;
  }

  function okResponse(content: string) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] }),
    };
  }

  it("returns the model's answer on success", async () => {
    const fn = stubFetch(async () => okResponse("Paris is the capital of France."));
    const result = await askGroq("What is the capital of France?");
    expect(result).toEqual({
      type: "answer",
      text: "Paris is the capital of France.",
    });
    // Called the Groq chat-completions endpoint with the env key.
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key-not-real",
    );
    const sentBody = JSON.parse(init.body as string) as {
      model: string;
      max_tokens: number;
      messages: { role: string; content: string }[];
    };
    expect(sentBody.model).toBe("llama-3.3-70b-versatile");
    expect(sentBody.messages[0]!.role).toBe("system");
    expect(sentBody.messages[sentBody.messages.length - 1]!.content).toBe(
      "What is the capital of France?",
    );
  });

  it("maps a [[HANDOVER]] reply to a handover", async () => {
    stubFetch(async () => okResponse("[[HANDOVER]]"));
    expect(await askGroq("Why was my application rejected?")).toEqual({
      type: "handover",
    });
  });

  it("returns unavailable on an HTTP error", async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(await askGroq("hello")).toEqual({ type: "unavailable" });
  });

  it("returns unavailable when fetch throws (network/timeout)", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    expect(await askGroq("hello")).toEqual({ type: "unavailable" });
  });

  it("returns unavailable when the key is missing, without calling fetch", async () => {
    delete process.env.GROQ_API_KEY;
    const fn = stubFetch(async () => okResponse("should not be used"));
    expect(await askGroq("hello")).toEqual({ type: "unavailable" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("honours the GROQ_MODEL override", async () => {
    process.env.GROQ_MODEL = "llama-3.1-8b-instant";
    const fn = stubFetch(async () => okResponse("ok"));
    await askGroq("hello");
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).model).toBe("llama-3.1-8b-instant");
  });

  it("retries with the fast model when the primary returns HTTP 500", async () => {
    let call = 0;
    const fn = stubFetch(async () => {
      call += 1;
      return call === 1
        ? { ok: false, status: 500, json: async () => ({}) }
        : okResponse("Answer from the fast model.");
    });
    const result = await askGroq("What is the capital of France?");
    expect(result).toEqual({
      type: "answer",
      text: "Answer from the fast model.",
    });
    expect(fn).toHaveBeenCalledTimes(2);
    const models = fn.mock.calls.map(
      (c) =>
        (JSON.parse((c[1] as RequestInit).body as string) as { model: string })
          .model,
    );
    expect(models).toEqual(["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]);
  });

  it("retries with the fast model when the primary attempt times out", async () => {
    let call = 0;
    const fn = stubFetch(async () => {
      call += 1;
      if (call === 1) {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        throw err;
      }
      return okResponse("Fast answer after the timeout.");
    });
    const result = await askGroq("hello");
    expect(result).toEqual({
      type: "answer",
      text: "Fast answer after the timeout.",
    });
    expect(fn).toHaveBeenCalledTimes(2);
    const secondInit = fn.mock.calls[1]![1] as RequestInit;
    expect(JSON.parse(secondInit.body as string).model).toBe(
      "llama-3.1-8b-instant",
    );
  });

  it("does not retry when the primary succeeds", async () => {
    const fn = stubFetch(async () => okResponse("One-shot answer."));
    expect(await askGroq("hello")).toEqual({
      type: "answer",
      text: "One-shot answer.",
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on a handover from the primary", async () => {
    const fn = stubFetch(async () => okResponse("[[HANDOVER]]"));
    expect(await askGroq("Why was my application rejected?")).toEqual({
      type: "handover",
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not swap models on failure when GROQ_MODEL is set", async () => {
    process.env.GROQ_MODEL = "custom-model-1";
    const fn = stubFetch(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    expect(await askGroq("hello")).toEqual({ type: "unavailable" });
    expect(fn).toHaveBeenCalledTimes(1);
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).model).toBe("custom-model-1");
  });
});

describe("knowledge base: general-questions entry", () => {
  it("answers questions about the assistant answering general questions", () => {
    const m = matchQuestion("Can the assistant answer general questions?");
    expect(m.isFallback).toBe(false);
    expect(m.entry?.id).toBe("general-questions-ai");
    expect(m.entry?.links?.map((l) => l.href)).toContain("/contact");
  });

  it("answers questions mentioning ChatGPT / AI", () => {
    const m = matchQuestion("Do you use ChatGPT or AI to answer?");
    expect(m.entry?.id).toBe("general-questions-ai");
  });

  it("does not steal the weather fallback example", () => {
    expect(matchQuestion("What is the weather in Karachi today?").isFallback).toBe(
      true,
    );
  });
});
