import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Rate-limiter tests with a mocked Supabase admin client (same pattern
 * as rbac.test.ts): lib/rate-limit.ts reads/writes rate_limit_hits via
 * the service-role client; here it is replaced with an in-memory fake
 * so the counting, blocking and failure-mode logic runs without a DB.
 *
 * The failure-mode split is SEC-11: credential buckets ("login",
 * "admin_login") fail CLOSED on a database error; all other buckets
 * fail OPEN.
 */

// vi.mock factories are hoisted above imports: the mutable admin holder
// must be created with vi.hoisted().
const mocks = vi.hoisted(() => ({
  holder: { admin: null as unknown },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.holder.admin,
}));

interface FakeState {
  countResult: { count: number | null; error: { message: string } | null };
  oldest: { created_at: string } | null;
  inserts: Array<Record<string, unknown>>;
}

function makeFakeAdmin(state: FakeState) {
  return {
    from(_table: string) {
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        gte() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: state.oldest, error: null });
        },
        insert(row: Record<string, unknown>) {
          state.inserts.push(row);
          return Promise.resolve({ error: null });
        },
        // The count query awaits the builder chain directly.
        then(resolve: (value: FakeState["countResult"]) => void) {
          resolve(state.countResult);
        },
      };
      return builder;
    },
  };
}

let state: FakeState;

beforeEach(() => {
  state = { countResult: { count: 0, error: null }, oldest: null, inserts: [] };
  mocks.holder.admin = makeFakeAdmin(state);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("checkRateLimit", () => {
  it("allows and records a hit when under the limit", async () => {
    const result = await checkRateLimit("login", "1.2.3.4", 5, 60);
    expect(result.allowed).toBe(true);
    expect(state.inserts).toEqual([{ bucket: "login", key: "1.2.3.4" }]);
  });

  it("blocks when the window count reaches the limit, with a retry-after", async () => {
    state.countResult = { count: 5, error: null };
    state.oldest = { created_at: new Date(Date.now() - 30_000).toISOString() };
    const result = await checkRateLimit("login", "1.2.3.4", 5, 60);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThanOrEqual(29);
    expect(result.retryAfterSec).toBeLessThanOrEqual(31);
    expect(state.inserts).toEqual([]);
  });

  it("SEC-11: fails CLOSED for the login bucket when the database check errors", async () => {
    state.countResult = { count: null, error: { message: "db down" } };
    const result = await checkRateLimit("login", "1.2.3.4", 5, 60);
    expect(result).toEqual({ allowed: false, retryAfterSec: 60 });
  });

  it("SEC-11: fails CLOSED for the admin_login bucket when the database check errors", async () => {
    state.countResult = { count: null, error: { message: "db down" } };
    const result = await checkRateLimit("admin_login", "1.2.3.4", 5, 60);
    expect(result).toEqual({ allowed: false, retryAfterSec: 60 });
  });

  it("SEC-11: still fails OPEN for non-credential buckets when the database check errors", async () => {
    state.countResult = { count: null, error: { message: "db down" } };
    const result = await checkRateLimit("contact", "1.2.3.4", 5, 3600);
    expect(result).toEqual({ allowed: true, retryAfterSec: 0 });
  });
});

describe("getClientIp", () => {
  it("takes the first X-Forwarded-For entry", () => {
    const headers = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip, then to 'unknown'", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
