import { describe, expect, it } from "vitest";
import {
  isPakistaniMobile,
  normalizePhone,
  validatePakistaniMobile,
} from "@/lib/phone";

/**
 * Pakistani mobile validation — task-specified cases.
 * Complements tests/phone.test.ts with the exact acceptance criteria:
 * 03XXXXXXXXX valid, +923XXXXXXXXX valid, invalid formats rejected,
 * non-PK numbers handled leniently by normalizePhone.
 */

describe("validatePakistaniMobile — accepted PK formats", () => {
  it("accepts 03XXXXXXXXX (local format) and normalizes to E.164", () => {
    const r = validatePakistaniMobile("03001234567");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("+923001234567");
    expect(r.error).toBeUndefined();
  });

  it("accepts +923XXXXXXXXX (E.164 with plus)", () => {
    const r = validatePakistaniMobile("+923001234567");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("+923001234567");
  });

  it("accepts 923XXXXXXXXX (E.164 without plus)", () => {
    const r = validatePakistaniMobile("923001234567");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("+923001234567");
  });

  it("tolerates common separators and surrounding whitespace", () => {
    for (const raw of [
      "0300-1234567",
      "0300 123 4567",
      "(0300) 1234567",
      "  03001234567  ",
      "+92 300 1234567",
    ]) {
      const r = validatePakistaniMobile(raw);
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe("+923001234567");
    }
  });

  it("isPakistaniMobile agrees with the validator", () => {
    expect(isPakistaniMobile("03001234567")).toBe(true);
    expect(isPakistaniMobile("+923001234567")).toBe(true);
    expect(isPakistaniMobile("0213456789")).toBe(false);
  });
});

describe("validatePakistaniMobile — rejected formats", () => {
  it("rejects landlines, short/long numbers, letters, and empty input", () => {
    for (const raw of [
      "02134567890", // Karachi landline
      "0300123456", // 10 digits — too short
      "030012345678", // 12 digits — too long
      "0300123456a", // letter
      "+92300123456", // E.164 too short
      "", // empty
      "0300", // prefix only
    ]) {
      const r = validatePakistaniMobile(raw);
      expect(r.valid).toBe(false);
      expect(r.normalized).toBeNull();
      expect(r.error).toMatch(/Pakistani mobile/i);
    }
  });

  it("rejects numbers that merely start with 03 but have wrong length", () => {
    expect(validatePakistaniMobile("031234567").valid).toBe(false);
    expect(validatePakistaniMobile("039999999999").valid).toBe(false);
  });
});

describe("normalizePhone — lenient, never assumes PK", () => {
  it("normalizes Pakistani mobiles to canonical E.164", () => {
    expect(normalizePhone("03001234567").normalized).toBe("+923001234567");
    expect(normalizePhone("+923001234567").normalized).toBe("+923001234567");
  });

  it("keeps other international numbers as-is", () => {
    const r = normalizePhone("+442071234567");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("+442071234567");
  });

  it("treats blank input as valid-but-absent (optional field)", () => {
    for (const raw of [null, undefined, "", "   "]) {
      const r = normalizePhone(raw);
      expect(r.valid).toBe(true);
      expect(r.normalized).toBeNull();
    }
  });

  it("rejects non-E.164 input that is not a PK mobile", () => {
    for (const raw of ["442071234567", "12345", "abc", "+92"]) {
      const r = normalizePhone(raw);
      expect(r.valid).toBe(false);
      expect(r.normalized).toBeNull();
    }
  });
});
