import { describe, expect, it, vi, beforeEach } from "vitest";

import { submitApplication } from "@/app/(candidate)/candidate/apply/[jobSlug]/_actions";

/**
 * submitApplication behavior tests with a mocked Supabase admin client.
 * Covers the duplicate-application handling (pre-check + 23505 → friendly
 * ALREADY_APPLIED mapping), required-question enforcement, consent, and the
 * happy path. The partial unique index itself is verified at the SQL level
 * in tests/duplicate-application-sql.test.ts.
 */

type Row = Record<string, unknown>;

// vi.mock factories are hoisted above imports: shared mutable fixtures must
// be created with vi.hoisted().
const mocks = vi.hoisted(() => ({
  guard: { requireCandidate: vi.fn(), getOrCreateCandidateProfile: vi.fn() },
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
const PROFILE_ID = "profile-1";
const JOB_ID = "job-1";
const QUESTION_ID = "11111111-1111-4111-8111-111111111111";
const CV_ID = "22222222-2222-4222-8222-222222222222";

interface ApplyFixtures {
  jobStatus?: string;
  jobDeadline?: string | null;
  existingApplication?: Row | null;
  questions?: Row[];
  cvProfileId?: string;
  /** Error returned by the applications INSERT (e.g. { code: "23505" }). */
  insertError?: { code: string; message: string } | null;
  capturedInserts?: Row[];
}

function makeAdmin(fx: ApplyFixtures) {
  const captured = fx.capturedInserts ?? [];
  return {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      const builder: Record<string, unknown> = {
        select(_cols: string) {
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return builder;
        },
        is(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return builder;
        },
        order(_col: string) {
          return builder;
        },
        insert(payload: unknown) {
          captured.push({ table, payload });
          return builder;
        },
        update(payload: unknown) {
          captured.push({ table, update: payload });
          return builder;
        },
        delete() {
          return builder;
        },
        maybeSingle() {
          if (table === "jobs") {
            return {
              data: {
                id: JOB_ID,
                org_id: "org-1",
                title: "Test Job",
                slug: "test-job",
                status: fx.jobStatus ?? "published",
                deadline: fx.jobDeadline ?? null,
                org: { name: "Test Org" },
              },
              error: null,
            };
          }
          if (table === "applications") {
            return { data: fx.existingApplication ?? null, error: null };
          }
          if (table === "candidate_documents") {
            return {
              data: {
                id: CV_ID,
                storage_path: "cvs/user-1/x.pdf",
                file_name: "cv.pdf",
                mime_type: "application/pdf",
                size_bytes: 100,
                profile_id: fx.cvProfileId ?? PROFILE_ID,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        single() {
          if (table === "applications" && fx.insertError) {
            return { data: null, error: fx.insertError };
          }
          if (table === "applications") {
            return { data: { id: "app-new" }, error: null };
          }
          return { data: null, error: null };
        },
        then(resolve: (v: unknown) => void) {
          if (table === "job_questions") {
            resolve({ data: fx.questions ?? [], error: null });
          } else {
            resolve({ data: null, error: null });
          }
        },
      };
      return builder;
    },
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    jobSlug: "test-job",
    answers: [{ questionId: QUESTION_ID, answer: "I am a great fit." }],
    documentId: CV_ID,
    coverLetter: "Hello.",
    consent: true,
    ...overrides,
  };
}

const REQUIRED_QUESTION = {
  id: QUESTION_ID,
  question: "Why do you want this job?",
  is_required: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  guard.requireCandidate.mockResolvedValue({ id: USER_ID });
  guard.getOrCreateCandidateProfile.mockResolvedValue({ id: PROFILE_ID });
  notify.mockResolvedValue(undefined);
});

describe("submitApplication — duplicate handling", () => {
  it("maps a 23505 insert violation to ALREADY_APPLIED", async () => {
    holder.admin = makeAdmin({
      questions: [REQUIRED_QUESTION],
      insertError: { code: "23505", message: "duplicate key value" },
    });
    const res = await submitApplication(validInput());
    expect(res.ok).toBe(false);
    expect(res.code).toBe("ALREADY_APPLIED");
    expect(res.error).toBe("You've already applied to this job.");
  });

  it("short-circuits on the pre-check when an active application exists", async () => {
    const captured: Row[] = [];
    holder.admin = makeAdmin({
      questions: [REQUIRED_QUESTION],
      existingApplication: { id: "app-old" },
      capturedInserts: captured,
    });
    const res = await submitApplication(validInput());
    expect(res.ok).toBe(false);
    expect(res.code).toBe("ALREADY_APPLIED");
    // No INSERT attempted.
    expect(captured.some((c) => c.table === "applications")).toBe(false);
  });

  it("throws on non-duplicate insert errors", async () => {
    holder.admin = makeAdmin({
      questions: [REQUIRED_QUESTION],
      insertError: { code: "500", message: "boom" },
    });
    await expect(submitApplication(validInput())).rejects.toThrow(
      /Failed to submit application/,
    );
  });
});

describe("submitApplication — validation", () => {
  it("rejects unanswered required questions", async () => {
    holder.admin = makeAdmin({ questions: [REQUIRED_QUESTION] });
    const res = await submitApplication(
      validInput({ answers: [{ questionId: QUESTION_ID, answer: "   " }] }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/required question/);
  });

  it("rejects answers to unknown questions", async () => {
    holder.admin = makeAdmin({ questions: [] });
    const res = await submitApplication(
      validInput({ answers: [{ questionId: QUESTION_ID, answer: "x" }] }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Invalid question/);
  });

  it("rejects a CV that does not belong to the candidate", async () => {
    holder.admin = makeAdmin({
      questions: [REQUIRED_QUESTION],
      cvProfileId: "profile-other",
    });
    const res = await submitApplication(validInput());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/could not be found/);
  });

  it("rejects missing consent", async () => {
    holder.admin = makeAdmin({ questions: [REQUIRED_QUESTION] });
    const res = await submitApplication(validInput({ consent: false }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/consent/i);
  });

  it("rejects closed jobs (not published)", async () => {
    holder.admin = makeAdmin({ jobStatus: "closed" });
    const res = await submitApplication(validInput());
    expect(res.ok).toBe(false);
    expect(res.code).toBe("JOB_CLOSED");
  });

  it("rejects jobs past their deadline", async () => {
    holder.admin = makeAdmin({
      jobDeadline: new Date(Date.now() - 86400000).toISOString(),
    });
    const res = await submitApplication(validInput());
    expect(res.ok).toBe(false);
    expect(res.code).toBe("JOB_CLOSED");
  });
});

describe("submitApplication — happy path", () => {
  it("inserts the application + answers + documents + history + consent", async () => {
    const captured: Row[] = [];
    holder.admin = makeAdmin({
      questions: [REQUIRED_QUESTION],
      capturedInserts: captured,
    });
    const res = await submitApplication(validInput());
    expect(res.ok).toBe(true);
    expect(res.applicationId).toBe("app-new");

    const tables = captured.map((c) => c.table);
    for (const t of [
      "applications",
      "application_answers",
      "application_documents",
      "application_status_history",
      "consent_records",
    ]) {
      expect(tables).toContain(t);
    }
    const appInsert = captured.find((c) => c.table === "applications");
    expect((appInsert!.payload as Row).stage).toBe("applied");
    expect((appInsert!.payload as Row).user_id).toBe(USER_ID);
    expect(notify).toHaveBeenCalledOnce();
  });
});
