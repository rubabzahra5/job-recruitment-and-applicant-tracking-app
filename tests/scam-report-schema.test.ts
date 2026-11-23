/**
 * Scam-report form schema (Phase 1, item 8).
 *
 * Pins the Zod contract shared by the /report-scam client form and its
 * server action: only the description and scam type are required,
 * reporter details are optional, a non-empty email must be valid, and the
 * scam types match migration 0019's CHECK constraint.
 */
import { describe, expect, it } from "vitest";

import {
  extractJobId,
  scamReportSchema,
} from "@/app/(public)/report-scam/_schemas";

const VALID = {
  scamType: "money_asked",
  description: "They asked me to send Rs. 5,000 as a processing fee on WhatsApp.",
};

describe("scamReportSchema", () => {
  it("accepts a minimal valid report (only type + description)", () => {
    const parsed = scamReportSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
  });

  it("accepts a fully populated report", () => {
    const parsed = scamReportSchema.safeParse({
      ...VALID,
      reporterName: "Ali Raza",
      reporterEmail: "ali@example.com",
      jobLink: "https://talentbridge.example/jobs/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      organizationName: "ABC Traders",
      evidenceUrls: "https://example.com/screenshot.png",
    });
    expect(parsed.success).toBe(true);
  });

  it("treats empty-string optional fields as fine (browser form default)", () => {
    const parsed = scamReportSchema.safeParse({
      ...VALID,
      reporterName: "",
      reporterEmail: "",
      jobLink: "",
      organizationName: "",
      evidenceUrls: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid reporter email when one is given", () => {
    const parsed = scamReportSchema.safeParse({ ...VALID, reporterEmail: "not-an-email" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a missing or unknown scam type", () => {
    expect(scamReportSchema.safeParse({ description: VALID.description }).success).toBe(false);
    expect(
      scamReportSchema.safeParse({ ...VALID, scamType: "rude_employer" }).success,
    ).toBe(false);
  });

  it("accepts every scam type in the migration's CHECK list", () => {
    for (const scamType of ["money_asked", "fake_job", "impersonation", "phishing", "other"]) {
      expect(scamReportSchema.safeParse({ ...VALID, scamType }).success).toBe(true);
    }
  });

  it("rejects a too-short description", () => {
    const parsed = scamReportSchema.safeParse({ ...VALID, description: "It is a scam." });
    expect(parsed.success).toBe(false);
  });

  it("rejects an over-long description", () => {
    const parsed = scamReportSchema.safeParse({
      ...VALID,
      description: "x".repeat(5001),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("extractJobId", () => {
  const UUID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

  it("returns a bare UUID", () => {
    expect(extractJobId(UUID)).toBe(UUID);
  });

  it("extracts a UUID from a job URL and lowercases it", () => {
    expect(extractJobId(`https://talentbridge.example/jobs/${UUID.toUpperCase()}`)).toBe(UUID);
  });

  it("returns null for a slug link, plain text, empty and missing input", () => {
    expect(extractJobId("https://talentbridge.example/jobs/software-engineer-lahore")).toBeNull();
    expect(extractJobId("the job at ABC Traders")).toBeNull();
    expect(extractJobId("")).toBeNull();
    expect(extractJobId(undefined)).toBeNull();
    expect(extractJobId(null)).toBeNull();
  });
});
