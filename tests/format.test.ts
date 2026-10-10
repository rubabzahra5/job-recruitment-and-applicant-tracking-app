import { describe, expect, it } from "vitest";
import {
  formatDateKarachi,
  formatPKR,
  formatSalaryRange,
  karachiWallClockToUTC,
  timeAgo,
} from "@/lib/format";

describe("formatPKR", () => {
  it("formats with Rs prefix and Pakistani digit grouping", () => {
    expect(formatPKR(85000)).toBe("Rs 85,000");
    expect(formatPKR(100000)).toBe("Rs 1,00,000");
    expect(formatPKR(1500000)).toBe("Rs 15,00,000");
    expect(formatPKR("250000")).toBe("Rs 2,50,000");
  });

  it("returns an em dash for missing/invalid input", () => {
    expect(formatPKR(null)).toBe("—");
    expect(formatPKR(undefined)).toBe("—");
    expect(formatPKR("")).toBe("—");
    expect(formatPKR("abc")).toBe("—");
  });
});

describe("formatSalaryRange", () => {
  it("formats a full range with period", () => {
    expect(formatSalaryRange(80000, 120000, "monthly")).toBe("Rs 80,000 – Rs 1,20,000 / month");
  });

  it("handles open-ended ranges", () => {
    expect(formatSalaryRange(80000, null, "monthly")).toBe("Rs 80,000 / month");
    expect(formatSalaryRange(null, 120000, "annual")).toBe("Rs 1,20,000 / year");
  });

  it("reports undisclosed when both ends are missing", () => {
    expect(formatSalaryRange(null, null)).toBe("Not disclosed");
  });
});

describe("formatDateKarachi", () => {
  it("converts a UTC instant to Asia/Karachi wall time", () => {
    // 12:00 UTC == 17:00 in Karachi (UTC+5, no DST)
    const out = formatDateKarachi("2026-10-10T12:00:00Z", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Karachi",
    });
    expect(out).toContain("17:00");
  });

  it("returns an em dash for missing input", () => {
    expect(formatDateKarachi(null)).toBe("—");
  });
});

describe("karachiWallClockToUTC", () => {
  it("interprets datetime-local input as Karachi wall time", () => {
    const d = karachiWallClockToUTC("2026-10-10T17:00");
    expect(d.toISOString()).toBe("2026-10-10T12:00:00.000Z");
  });

  it("throws on invalid input", () => {
    expect(() => karachiWallClockToUTC("not-a-date")).toThrow();
  });
});

describe("timeAgo", () => {
  it("produces relative labels", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(timeAgo(new Date("2026-10-10T11:59:30Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-10-10T11:30:00Z"), now)).toBe("30 min ago");
    expect(timeAgo(new Date("2026-10-10T09:00:00Z"), now)).toBe("3 hr ago");
    expect(timeAgo(new Date("2026-10-08T12:00:00Z"), now)).toBe("2 days ago");
  });
});
