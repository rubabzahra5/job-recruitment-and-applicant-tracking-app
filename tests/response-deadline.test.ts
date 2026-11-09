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
