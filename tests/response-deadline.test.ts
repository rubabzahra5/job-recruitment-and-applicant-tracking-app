import { describe, expect, it } from "vitest";
import {
  addBusinessDaysKarachi,
  businessDaysBetweenKarachi,
  computeOrgResponseRate,
  deriveResponseStatus,
  getFirstResponseAt,
  getResponseDeadline,
  getResponseReminderAt,
} from "@/lib/response-deadline";
import { isPakistanHoliday } from "@/lib/pakistan-holidays";

// Calendar anchors (Asia/Karachi): Mon 2026-10-05, Fri 2026-10-02,
// Sat 2026-10-03, Sun 2026-10-04 (2026-11-09 is a Monday).
const MON = "2026-10-05T09:00:00+05:00";
const FRI = "2026-10-02T09:00:00+05:00";
const SAT = "2026-10-03T09:00:00+05:00";

describe("addBusinessDaysKarachi", () => {
  it("adds 7 business days from a Monday, landing end of next Wednesday", () => {
    const d = addBusinessDaysKarachi(new Date(MON), 7);
    // Tue6 Wed7 Thu8 Fri9 Mon12 Tue13 Wed14 → end of Wed 14 Oct Karachi.
    expect(d.toISOString()).toBe("2026-10-14T18:59:59.999Z");
  });

  it("skips the weekend when counting from a Friday", () => {
    const d = addBusinessDaysKarachi(new Date(FRI), 7);
    // Mon5 Tue6 Wed7 Thu8 Fri9 Mon12 Tue13 → end of Tue 13 Oct Karachi.
    expect(d.toISOString()).toBe("2026-10-13T18:59:59.999Z");
  });

  it("starts counting after a weekend submission", () => {
    const d = addBusinessDaysKarachi(new Date(SAT), 7);
    expect(d.toISOString()).toBe("2026-10-13T18:59:59.999Z");
  });

  it("computes the day-5 reminder point", () => {
    expect(getResponseReminderAt(MON).toISOString()).toBe("2026-10-12T18:59:59.999Z");
    expect(getResponseReminderAt(FRI).toISOString()).toBe("2026-10-09T18:59:59.999Z");
    expect(getResponseDeadline(MON).toISOString()).toBe("2026-10-14T18:59:59.999Z");
  });
});

describe("businessDaysBetweenKarachi", () => {
  it("counts business days forward, skipping weekends", () => {
    expect(businessDaysBetweenKarachi(new Date(MON), new Date("2026-10-14T12:00:00+05:00"))).toBe(7);
    expect(businessDaysBetweenKarachi(new Date(FRI), new Date("2026-10-05T12:00:00+05:00"))).toBe(1);
  });

  it("is 0 on the same Karachi date and negative when overdue", () => {
    expect(businessDaysBetweenKarachi(new Date(MON), new Date("2026-10-05T23:00:00+05:00"))).toBe(0);
    expect(businessDaysBetweenKarachi(new Date("2026-10-14T12:00:00+05:00"), new Date(MON))).toBe(-7);
  });
});

describe("getFirstResponseAt", () => {
  it("uses the first transition out of 'applied' from history", () => {
    const at = getFirstResponseAt({
      stage: "shortlisted",
      submitted_at: MON,
      statusHistory: [
        { from_stage: null, to_stage: "applied", created_at: MON },
        { from_stage: "applied", to_stage: "initial_screening", created_at: "2026-10-08T10:00:00+05:00" },
        { from_stage: "initial_screening", to_stage: "shortlisted", created_at: "2026-10-09T10:00:00+05:00" },
      ],
    });
    expect(at?.toISOString()).toBe("2026-10-08T05:00:00.000Z");
  });

  it("does not treat a withdrawal as an employer response", () => {
    const at = getFirstResponseAt({
      stage: "withdrawn",
      submitted_at: MON,
      statusHistory: [{ from_stage: "applied", to_stage: "withdrawn", created_at: "2026-10-06T10:00:00+05:00" }],
    });
    expect(at).toBeNull();
  });

  it("falls back to updated_at when history is unavailable", () => {
    const at = getFirstResponseAt({
      stage: "rejected",
      submitted_at: MON,
      updated_at: "2026-10-08T10:00:00+05:00",
    });
    expect(at?.toISOString()).toBe("2026-10-08T05:00:00.000Z");
  });

  it("returns null for a still-applied application", () => {
    expect(getFirstResponseAt({ stage: "applied", submitted_at: MON, updated_at: MON })).toBeNull();
    expect(getFirstResponseAt({ stage: "applied", submitted_at: MON, statusHistory: [] })).toBeNull();
  });

  it("falls back to updated_at when history exists but the stage was set without a history row", () => {
    // Seeded / pre-history-tracking data: no history rows at all, but the
    // application visibly progressed — the employer did respond.
    const at = getFirstResponseAt({
      stage: "shortlisted",
      submitted_at: MON,
      updated_at: "2026-10-08T10:00:00+05:00",
      statusHistory: [],
    });
    expect(at?.toISOString()).toBe("2026-10-08T05:00:00.000Z");
  });

  it("falls back to updated_at when history holds only the creation row but the stage progressed", () => {
    const at = getFirstResponseAt({
      stage: "interview_scheduled",
      submitted_at: MON,
      updated_at: "2026-10-09T10:00:00+05:00",
      statusHistory: [{ from_stage: null, to_stage: "applied", created_at: MON }],
    });
    expect(at?.toISOString()).toBe("2026-10-09T05:00:00.000Z");
  });

  it("uses the earliest recorded move out of 'applied' when the exit transition itself is missing", () => {
    const at = getFirstResponseAt({
      stage: "shortlisted",
      submitted_at: MON,
      updated_at: "2026-10-12T10:00:00+05:00",
      statusHistory: [
        { from_stage: null, to_stage: "applied", created_at: MON },
        { from_stage: "initial_screening", to_stage: "shortlisted", created_at: "2026-10-09T10:00:00+05:00" },
      ],
    });
    expect(at?.toISOString()).toBe("2026-10-09T05:00:00.000Z");
  });
});

describe("deriveResponseStatus", () => {
  it("is 'awaiting' inside the first 5 business days", () => {
    const s = deriveResponseStatus({ stage: "applied", submitted_at: MON }, new Date("2026-10-07T12:00:00+05:00"));
    expect(s.kind).toBe("awaiting");
    expect(s.deadline.toISOString()).toBe("2026-10-14T18:59:59.999Z");
  });

  it("is 'due-soon' after the day-5 reminder point, before the deadline", () => {
    const s = deriveResponseStatus({ stage: "applied", submitted_at: MON }, new Date("2026-10-13T12:00:00+05:00"));
    expect(s.kind).toBe("due-soon");
    expect(s.businessDaysLeft).toBe(1);
  });

  it("is 'no-response' after the deadline with no response", () => {
    const s = deriveResponseStatus({ stage: "applied", submitted_at: MON }, new Date("2026-10-15T12:00:00+05:00"));
    expect(s.kind).toBe("no-response");
    expect(s.onTime).toBe(false);
    expect(s.businessDaysLeft).toBe(-1);
  });

  it("is 'responded' on time when the employer moved it within the deadline", () => {
    const s = deriveResponseStatus(
      {
        stage: "initial_screening",
        submitted_at: MON,
        statusHistory: [{ from_stage: "applied", to_stage: "initial_screening", created_at: "2026-10-08T10:00:00+05:00" }],
      },
      new Date("2026-10-20T12:00:00+05:00"),
    );
    expect(s.kind).toBe("responded");
    expect(s.onTime).toBe(true);
  });

  it("is 'responded' but late when the first move came after the deadline", () => {
    const s = deriveResponseStatus(
      {
        stage: "rejected",
        submitted_at: MON,
        statusHistory: [{ from_stage: "applied", to_stage: "rejected", created_at: "2026-10-20T10:00:00+05:00" }],
      },
      new Date("2026-10-21T12:00:00+05:00"),
    );
    expect(s.kind).toBe("responded");
    expect(s.onTime).toBe(false);
  });

  it("is 'withdrawn' when the candidate withdrew before any response", () => {
    const s = deriveResponseStatus(
      {
        stage: "withdrawn",
        submitted_at: MON,
        statusHistory: [{ from_stage: "applied", to_stage: "withdrawn", created_at: "2026-10-06T10:00:00+05:00" }],
      },
      new Date("2026-10-20T12:00:00+05:00"),
    );
    expect(s.kind).toBe("withdrawn");
  });
});

describe("computeOrgResponseRate", () => {
  it("counts only on-time responses, and excludes pre-response withdrawals", () => {
    const now = new Date("2026-10-20T12:00:00+05:00");
    const rate = computeOrgResponseRate(
      [
        // on-time response
        {
          stage: "shortlisted",
          submitted_at: MON,
          statusHistory: [{ from_stage: "applied", to_stage: "initial_screening", created_at: "2026-10-08T10:00:00+05:00" }],
        },
        // late response
        {
          stage: "rejected",
          submitted_at: MON,
          statusHistory: [{ from_stage: "applied", to_stage: "rejected", created_at: "2026-10-19T10:00:00+05:00" }],
        },
        // never responded, deadline passed
        { stage: "applied", submitted_at: MON, statusHistory: [] },
        // still within the window (counts in the denominator, not yet a miss)
        { stage: "applied", submitted_at: "2026-10-19T09:00:00+05:00", statusHistory: [] },
        // withdrawn before response — excluded entirely
        {
          stage: "withdrawn",
          submitted_at: MON,
          statusHistory: [{ from_stage: "applied", to_stage: "withdrawn", created_at: "2026-10-06T10:00:00+05:00" }],
        },
      ],
      now,
    );
    expect(rate.totalApplications).toBe(4);
    expect(rate.responded).toBe(2);
    expect(rate.respondedOnTime).toBe(1);
    expect(rate.responseRate).toBe(25);
  });

  it("returns a null rate with no applications", () => {
    expect(computeOrgResponseRate([]).responseRate).toBeNull();
  });
});

// ─── Pakistan public holidays ───────────────────────────────────────────────
// A business day is Mon–Fri AND not a public holiday (lib/pakistan-holidays).
// Dates used below: Eid ul-Fitr 2025 Mon 31 Mar – Wed 2 Apr; 2026 —
// Eid ul-Fitr Fri 20 – Sun 22 Mar, Pakistan Day Mon 23 Mar, Eid ul-Adha
// Wed 27 – Fri 29 May, Ashura Thu 25 – Fri 26 Jun, Independence Day
// Fri 14 Aug. (Islamic dates are the expected ones and may shift ±1 day
// with the official moon sighting.)

describe("Pakistan public holidays in the response rule", () => {
  it("recognises listed holidays and ordinary days", () => {
    expect(isPakistanHoliday(Date.UTC(2026, 2, 20))).toBe(true); // Eid ul-Fitr
    expect(isPakistanHoliday(Date.UTC(2026, 5, 25))).toBe(true); // Ashura
    expect(isPakistanHoliday(Date.UTC(2026, 7, 14))).toBe(true); // Independence Day
    expect(isPakistanHoliday(Date.UTC(2026, 2, 16))).toBe(false); // ordinary Monday
    // 14 Oct 2026 is NOT a holiday — the October windows used by the
    // original tests above are unaffected by the holiday calendar.
    expect(isPakistanHoliday(Date.UTC(2026, 9, 14))).toBe(false);
  });

  it("extends the deadline by exactly the Eid ul-Fitr weekdays in the window", () => {
    // Eid ul-Fitr 2025 fell Mon 31 Mar – Wed 2 Apr (all weekdays).
    // Submitted Wed 26 Mar 2025. Business days: Thu27 Fri28,
    // Mon31–Wed2 = Eid (skipped), Thu3 Fri4, Mon7 (reminder),
    // Tue8 Wed9 (deadline). Mon–Fri-only counting would land on
    // Fri 4 Apr; the deadline moves by exactly the 3 Eid weekdays.
    expect(getResponseDeadline("2025-03-26T09:00:00+05:00").toISOString()).toBe(
      "2025-04-09T18:59:59.999Z",
    );
    // The day-5 reminder shifts the same way (Mon 7 Apr, not Wed 2 Apr).
    expect(getResponseReminderAt("2025-03-26T09:00:00+05:00").toISOString()).toBe(
      "2025-04-07T18:59:59.999Z",
    );
  });

  it("stacks holidays that fall together (Eid ul-Fitr + Pakistan Day, 2026)", () => {
    // Submitted Mon 16 Mar 2026. Business days: Tue17 Wed18 Thu19,
    // Fri20 = Eid ul-Fitr (skipped), Mon23 = Pakistan Day (skipped),
    // Tue24 Wed25 (reminder) Thu26 Fri27 (deadline).
    expect(getResponseDeadline("2026-03-16T09:00:00+05:00").toISOString()).toBe(
      "2026-03-27T18:59:59.999Z",
    );
    expect(getResponseReminderAt("2026-03-16T09:00:00+05:00").toISOString()).toBe(
      "2026-03-25T18:59:59.999Z",
    );
  });

  it("does not mark an employer 'No response' on the holiday-extended deadline day", () => {
    const s = deriveResponseStatus(
      { stage: "applied", submitted_at: "2026-03-16T09:00:00+05:00" },
      new Date("2026-03-27T12:00:00+05:00"),
    );
    expect(s.kind).toBe("due-soon");
    expect(s.businessDaysLeft).toBe(0);
  });

  it("skips both Ashura weekdays", () => {
    // Submitted Mon 22 Jun 2026. Business days: Tue23 Wed24,
    // Thu25–Fri26 = Ashura (skipped), Mon29 Tue30 Wed1 Thu2 Fri3.
    expect(getResponseDeadline("2026-06-22T09:00:00+05:00").toISOString()).toBe(
      "2026-07-03T18:59:59.999Z",
    );
    expect(getResponseReminderAt("2026-06-22T09:00:00+05:00").toISOString()).toBe(
      "2026-07-01T18:59:59.999Z",
    );
    expect(
      businessDaysBetweenKarachi(
        new Date("2026-06-22T09:00:00+05:00"),
        new Date("2026-07-03T12:00:00+05:00"),
      ),
    ).toBe(7);
  });

  it("skips a fixed holiday that falls on a weekday (Independence Day)", () => {
    // Submitted Mon 10 Aug 2026. Business days: Tue11 Wed12 Thu13,
    // Fri14 = Independence Day (skipped), Mon17 Tue18 Wed19 Thu20.
    expect(getResponseDeadline("2026-08-10T09:00:00+05:00").toISOString()).toBe(
      "2026-08-20T18:59:59.999Z",
    );
  });

  it("changes nothing when a fixed holiday falls on a weekend", () => {
    // 14 Aug 2027 is a Saturday (and Eid Milad-un-Nabi 2027 falls on
    // Sunday 15 Aug), so Mon 9 Aug 2027 + 7 business days is exactly
    // the Mon–Fri-only result: end of Wed 18 Aug 2027.
    expect(getResponseDeadline("2027-08-09T09:00:00+05:00").toISOString()).toBe(
      "2027-08-18T18:59:59.999Z",
    );
  });

  it("counts a holiday-plus-weekend long stretch correctly (Eid ul-Adha 2026)", () => {
    // Submitted Mon 25 May 2026. Eid ul-Adha Wed27–Fri29 runs into the
    // weekend (Sat30–Sun31): five consecutive non-business days.
    // Business days: Tue26, Mon1 Jun, Tue2, Wed3, Thu4 (reminder),
    // Fri5, Mon8 (deadline).
    expect(getResponseDeadline("2026-05-25T09:00:00+05:00").toISOString()).toBe(
      "2026-06-08T18:59:59.999Z",
    );
    expect(getResponseReminderAt("2026-05-25T09:00:00+05:00").toISOString()).toBe(
      "2026-06-04T18:59:59.999Z",
    );
  });
});
