import { describe, expect, it, vi, beforeEach } from "vitest";

import { withdrawApplication } from "@/app/(candidate)/candidate/applications/_actions";

/**
 * Candidate withdrawal policy: a candidate may move their own application to
 * `withdrawn` only, and only from non-terminal pre-offer stages
 * (CANDIDATE_WITHDRAWABLE_STAGES in the action module). Tested here against
 * the real server action with a mocked Supabase client.
 */

type Row = Record<string, unknown>;

// vi.mock factories are hoisted above imports: shared mutable fixtures must
// be created with vi.hoisted().
const mocks = vi.hoisted(() => ({
  guard: { requireCandidate: vi.fn() },
  holder: { admin: null as unknown },
  notify: vi.fn(),
}));
const holder = mocks.holder;
const guard = mocks.guard;
const notify = mocks.notify;

vi.mock("@/app/(candidate)/_lib/candidate-guard", () => mocks.guard);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.holder.admin,
}));
vi.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mocks.notify(...args),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const USER_ID = "user-1";
const APP_ID = "app-1";

// Pipeline rows in the shape loadPipeline() expects from the loader.
const STAGE_ROWS: Row[] = [
  { id: "s1", key: "applied", label: "Applied", sort_order: 1, is_terminal: false },
  { id: "s8", key: "offer_pending", label: "Offer Pending", sort_order: 8, is_terminal: false },
  { id: "s9", key: "offer_accepted", label: "Offer Accepted", sort_order: 9, is_terminal: false },
  { id: "s11", key: "hired", label: "Hired", sort_order: 11, is_terminal: true },
  { id: "s12", key: "rejected", label: "Rejected", sort_order: 12, is_terminal: true },
  { id: "s13", key: "withdrawn", label: "Withdrawn", sort_order: 13, is_terminal: true },
];
const TRANSITION_ROWS: Row[] = [
  { from_stage: "s1", to_stage: "s13", from: { key: "applied" }, to: { key: "withdrawn" } },
  { from_stage: "s8", to_stage: "s13", from: { key: "offer_pending" }, to: { key: "withdrawn" } },
  { from_stage: "s9", to_stage: "s13", from: { key: "offer_accepted" }, to: { key: "withdrawn" } },
];

function makeAdmin(opts: { appRow: Row | null; updates: Row[] }) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select(_cols: string) {
          return builder;
        },
        eq(_col: string, _val: unknown) {
          return builder;
        },
        update(payload: unknown) {
          opts.updates.push({ table, payload });
          return builder;
        },
        insert(_payload: unknown) {
          return builder;
        },
        maybeSingle() {
          if (table === "applications") {
            return { data: opts.appRow, error: null };
          }
          return { data: null, error: null };
        },
        then(resolve: (v: unknown) => void) {
          if (table === "pipeline_stages") {
            resolve({ data: STAGE_ROWS, error: null });
          } else if (table === "pipeline_transitions") {
            resolve({ data: TRANSITION_ROWS, error: null });
          } else {
            resolve({ data: null, error: null });
          }
        },
      };
      return builder;
    },
  };
}

function appRow(stage: string, userId: string = USER_ID): Row {
  return {
    id: APP_ID,
    stage,
    user_id: userId,
    job_id: "job-1",
    snapshot_title: "Test Job",
    snapshot_org_name: "Test Org",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  guard.requireCandidate.mockResolvedValue({ id: USER_ID });
  notify.mockResolvedValue(undefined);
});

describe("withdrawApplication — candidate→withdrawn policy", () => {
  it("withdraws from an early stage (applied)", async () => {
    const updates: Row[] = [];
    holder.admin = makeAdmin({ appRow: appRow("applied"), updates });
    const res = await withdrawApplication(APP_ID);
    expect(res.ok).toBe(true);
    expect(updates).toHaveLength(1);
    expect((updates[0]!.payload as Row).stage).toBe("withdrawn");
    expect(notify).toHaveBeenCalledOnce();
  });

  it("withdraws from the latest allowed stage (offer_pending)", async () => {
    const updates: Row[] = [];
    holder.admin = makeAdmin({ appRow: appRow("offer_pending"), updates });
    const res = await withdrawApplication(APP_ID);
    expect(res.ok).toBe(true);
    expect((updates[0]!.payload as Row).stage).toBe("withdrawn");
  });

  it("refuses withdrawal from hired (terminal)", async () => {
    const updates: Row[] = [];
    holder.admin = makeAdmin({ appRow: appRow("hired"), updates });
    const res = await withdrawApplication(APP_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/can no longer be withdrawn/i);
    expect(updates).toHaveLength(0);
  });

  it("refuses withdrawal from offer_accepted (policy stricter than transition table)", async () => {
    // The transition table allows offer_accepted → withdrawn, but the
    // candidate portal policy blocks it: the candidate must contact the employer.
    const updates: Row[] = [];
    holder.admin = makeAdmin({ appRow: appRow("offer_accepted"), updates });
    const res = await withdrawApplication(APP_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/can no longer be withdrawn/i);
    expect(updates).toHaveLength(0);
  });

  it("refuses withdrawal from rejected and withdrawn", async () => {
    for (const stage of ["rejected", "withdrawn"]) {
      const updates: Row[] = [];
      holder.admin = makeAdmin({ appRow: appRow(stage), updates });
      const res = await withdrawApplication(APP_ID);
      expect(res.ok).toBe(false);
      expect(updates).toHaveLength(0);
    }
  });

  it("fails for applications the candidate does not own", async () => {
    const updates: Row[] = [];
    holder.admin = makeAdmin({ appRow: appRow("applied", "user-other"), updates });
    const res = await withdrawApplication(APP_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Application not found.");
    expect(updates).toHaveLength(0);
  });

  it("fails for missing applications", async () => {
    const updates: Row[] = [];
    holder.admin = makeAdmin({ appRow: null, updates });
    const res = await withdrawApplication(APP_ID);
    expect(res.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });
});
