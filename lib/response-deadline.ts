/**
 * Application response rule — "5–7 business days" (H-response-rule).
 *
 * TalentBridge's promise to candidates: every application gets a company
 * response within 7 business days (Mon–Fri, Asia/Karachi). A "response" is
 * the application first moving beyond the `applied` stage — In review,
 * moved forward (Accepted) or Rejected all count. Day 5 is the reminder
 * point. If the deadline passes with no response:
 *   - the candidate sees a clear "No response" state, and
 *   - the company's public response rate only counts ON-TIME responses,
 *     so late or missing responses lower the rate.
 *
 * Everything here is DERIVED from existing data (applications.submitted_at,
 * applications.stage, application_status_history). No new columns, no
 * migration — the rule can be computed for any application, past or future.
 *
 * This module is pure (no Supabase imports) so it is unit-testable and can
 * be shared by server pages and the response-rate helper in
 * lib/responsiveness.ts.
 */

export const RESPONSE_DEADLINE_BUSINESS_DAYS = 7;
export const RESPONSE_REMINDER_BUSINESS_DAYS = 5;

const DAY_MS = 86_400_000;
/** Asia/Karachi is UTC+05:00 year-round (no DST). */
const KARACHI_OFFSET_MS = 5 * 3_600_000;

// ─── Karachi business-day math ──────────────────────────────────────────────

/**
 * The Karachi calendar date containing `instant`, expressed as the UTC
 * timestamp of that date's midnight (an abstract calendar day used only
 * for day arithmetic — never render it directly).
 */
function karachiDateMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

function isBusinessDateMs(dateMs: number): boolean {
  const dow = new Date(dateMs).getUTCDay(); // calendar day is stored as UTC midnight
  return dow >= 1 && dow <= 5; // Mon–Fri
}

/** End of a Karachi calendar day (23:59:59.999 +05:00) as an instant. */
function endOfKarachiDayMs(dateMs: number): number {
  return dateMs + (24 * 3_600_000 - 1) - KARACHI_OFFSET_MS;
}

/**
 * Add `businessDays` business days (Mon–Fri) to the Karachi calendar date
 * of `from`, returning the END of the resulting Karachi day. The starting
 * day itself is never counted, so e.g. a Monday submission + 7 business
 * days lands at the end of the following Wednesday.
 */
export function addBusinessDaysKarachi(from: Date, businessDays: number): Date {
  let cur = karachiDateMs(from);
  let remaining = businessDays;
  while (remaining > 0) {
    cur += DAY_MS;
    if (isBusinessDateMs(cur)) remaining -= 1;
  }
  return new Date(endOfKarachiDayMs(cur));
}

/**
 * Business days from `from` to `to` (Karachi calendar dates): positive when
 * `to` is later, 0 when both fall on the same Karachi date, negative when
 * `to` is earlier (i.e. overdue by that many business days).
 */
export function businessDaysBetweenKarachi(from: Date, to: Date): number {
  const a = karachiDateMs(from);
  const b = karachiDateMs(to);
  if (a === b) return 0;
  if (b < a) return -businessDaysBetweenKarachi(to, from);
  let n = 0;
  for (let cur = a + DAY_MS; cur <= b; cur += DAY_MS) {
    if (isBusinessDateMs(cur)) n += 1;
  }
  return n;
}

/** The instant by which a company must first respond (7 business days). */
export function getResponseDeadline(submittedAt: Date | string): Date {
  return addBusinessDaysKarachi(new Date(submittedAt), RESPONSE_DEADLINE_BUSINESS_DAYS);
}

/** The reminder point (5 business days after submission). */
export function getResponseReminderAt(submittedAt: Date | string): Date {
  return addBusinessDaysKarachi(new Date(submittedAt), RESPONSE_REMINDER_BUSINESS_DAYS);
}

// ─── First-response derivation ──────────────────────────────────────────────

export interface StatusHistoryEntry {
  from_stage: string | null;
  to_stage: string;
  created_at: string;
}

export interface ApplicationResponseInput {
  stage: string;
  submitted_at: string;
  updated_at?: string | null;
  /** Full status history when available (authoritative). */
  statusHistory?: StatusHistoryEntry[] | null;
}

/**
 * When did the employer first respond? A response is the first transition
 * OUT of `applied` to any stage other than `withdrawn` (a withdrawal is the
 * candidate's own action, not an employer response).
 *
 * Derived from application_status_history when provided. When history is
 * unavailable, falls back to `updated_at` for applications no longer in
 * `applied` — the same proxy the legacy response-rate code used.
 */
export function getFirstResponseAt(app: ApplicationResponseInput): Date | null {
  const history = app.statusHistory;
  if (history != null) {
    const sorted = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    for (const h of sorted) {
      const isResponse =
        h.to_stage !== "applied" &&
        h.to_stage !== "withdrawn" &&
        (h.from_stage === "applied" || h.from_stage == null);
      if (isResponse) return new Date(h.created_at);
    }
    return null; // History is authoritative: no employer response recorded.
  }
  if (app.stage !== "applied" && app.stage !== "withdrawn" && app.updated_at) {
    const d = new Date(app.updated_at);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ─── Per-application response status ────────────────────────────────────────

export type ResponseStatusKind =
  | "awaiting" // submitted, still within the 5-business-day comfort zone
  | "due-soon" // past the day-5 reminder point, deadline not yet reached
  | "responded" // employer responded (see onTime)
  | "no-response" // deadline passed, still in `applied` — a breach
  | "withdrawn"; // candidate withdrew before any employer response

export interface ResponseStatus {
  kind: ResponseStatusKind;
  /** End of the 7th business day after submission (Karachi). */
  deadline: Date;
  /** End of the 5th business day after submission (Karachi). */
  reminderAt: Date;
  respondedAt: Date | null;
  /** True when the response arrived on or before the deadline. */
  onTime: boolean | null;
  /**
   * Business days remaining until the deadline (Karachi calendar):
   * 0 = due today, negative = overdue by that many business days.
   * Only meaningful for awaiting / due-soon / no-response.
   */
  businessDaysLeft: number;
}

export function deriveResponseStatus(
  app: ApplicationResponseInput,
  now: Date = new Date(),
): ResponseStatus {
  const submitted = new Date(app.submitted_at);
  const deadline = getResponseDeadline(submitted);
  const reminderAt = getResponseReminderAt(submitted);
  const respondedAt = getFirstResponseAt(app);
  const businessDaysLeft = businessDaysBetweenKarachi(now, deadline);

  if (respondedAt) {
    return {
      kind: "responded",
      deadline,
      reminderAt,
      respondedAt,
      onTime: respondedAt.getTime() <= deadline.getTime(),
      businessDaysLeft,
    };
  }
  if (app.stage === "withdrawn") {
    return { kind: "withdrawn", deadline, reminderAt, respondedAt: null, onTime: null, businessDaysLeft };
  }
  if (now.getTime() > deadline.getTime()) {
    return { kind: "no-response", deadline, reminderAt, respondedAt: null, onTime: false, businessDaysLeft };
  }
  if (now.getTime() > reminderAt.getTime()) {
    return { kind: "due-soon", deadline, reminderAt, respondedAt: null, onTime: null, businessDaysLeft };
  }
  return { kind: "awaiting", deadline, reminderAt, respondedAt: null, onTime: null, businessDaysLeft };
}

// ─── Organization response rate (on-time) ───────────────────────────────────

export interface OrgResponseRate {
  /** % of applications responded to within the deadline; null if no data. */
  responseRate: number | null;
  /** Denominator: applications in the window (excl. pre-response withdrawals). */
  totalApplications: number;
  respondedOnTime: number;
  responded: number;
}

/**
 * The shared response-rate formula — used by job cards, company pages and
 * employer views so the number is identical everywhere:
 *
 *   response rate = applications first responded to within 7 business days
 *                   ÷ applications in the window
 *
 * Applications the candidate withdrew before any employer response are
 * excluded from both sides — a withdrawal is not the employer's miss.
 */
export function computeOrgResponseRate(
  apps: ApplicationResponseInput[],
  now: Date = new Date(),
): OrgResponseRate {
  let total = 0;
  let responded = 0;
  let respondedOnTime = 0;
  for (const app of apps) {
    const s = deriveResponseStatus(app, now);
    if (s.kind === "withdrawn") continue;
    total += 1;
    if (s.kind === "responded") {
      responded += 1;
      if (s.onTime) respondedOnTime += 1;
    }
  }
  return {
    responseRate: total > 0 ? Math.round((respondedOnTime / total) * 100) : null,
    totalApplications: total,
    respondedOnTime,
    responded,
  };
}

/**
 * Fetch status history for a set of applications and group it by
 * application id. Works with any Supabase-like client (structural typing
 * keeps this module free of client imports). Returns an empty map on error
 * so callers can fall back to stage/updated_at derivation.
 */
/** Minimal structural type of the Supabase client used by the fetcher below. */
export interface StatusHistoryDb {
  from: (table: string) => {
    select: (cols: string) => {
      in: (
        col: string,
        values: string[],
      ) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
    };
  };
}

export async function fetchStatusHistoryByApplication(
  db: StatusHistoryDb,
  applicationIds: string[],
): Promise<Map<string, StatusHistoryEntry[]>> {
  const map = new Map<string, StatusHistoryEntry[]>();
  for (let i = 0; i < applicationIds.length; i += 200) {
    const chunk = applicationIds.slice(i, i + 200);
    const { data, error } = await db
      .from("application_status_history")
      .select("application_id,from_stage,to_stage,created_at")
      .in("application_id", chunk);
    if (error || !data) continue;
    for (const row of data as Array<{
      application_id: string;
      from_stage: string | null;
      to_stage: string;
      created_at: string;
    }>) {
      const list = map.get(row.application_id) ?? [];
      list.push({ from_stage: row.from_stage, to_stage: row.to_stage, created_at: row.created_at });
      map.set(row.application_id, list);
    }
  }
  return map;
}
