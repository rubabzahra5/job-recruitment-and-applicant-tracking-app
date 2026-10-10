import { describe, expect, it } from "vitest";
import { isPakistaniMobile, normalizePhone, validatePakistaniMobile } from "@/lib/phone";

describe("validatePakistaniMobile", () => {
  it("accepts local 03XXXXXXXXX format", () => {
    expect(validatePakistaniMobile("03001234567")).toEqual({
      valid: true,
      normalized: "+923001234567",
    });
  });

  it("accepts +923XXXXXXXXX format", () => {
    expect(validatePakistaniMobile("+923001234567").valid).toBe(true);
    expect(validatePakistaniMobile("+923001234567").normalized).toBe("+923001234567");
  });

  it("accepts 923XXXXXXXXX without plus", () => {
    expect(validatePakistaniMobile("923001234567").normalized).toBe("+923001234567");
  });

  it("tolerates spaces and dashes", () => {
    expect(validatePakistaniMobile("0300 123 4567").valid).toBe(true);
    expect(validatePakistaniMobile("0300-123-4567").valid).toBe(true);
  });

  it("rejects non-PK numbers and wrong lengths", () => {
    expect(validatePakistaniMobile("0300123456").valid).toBe(false);
    expect(validatePakistaniMobile("04001234567").valid).toBe(false);
    expect(validatePakistaniMobile("+442071234567").valid).toBe(false);
    expect(validatePakistaniMobile("not-a-number").valid).toBe(false);
  });
});

describe("normalizePhone (lenient, no PK assumption)", () => {
  it("returns null for empty input", () => {
    expect(normalizePhone("")).toEqual({ valid: true, normalized: null });
    expect(normalizePhone(null)).toEqual({ valid: true, normalized: null });
    expect(normalizePhone(undefined)).toEqual({ valid: true, normalized: null });
  });

  it("normalizes Pakistani mobiles", () => {
    expect(normalizePhone("03001234567").normalized).toBe("+923001234567");
  });

  it("accepts other international numbers as-is", () => {
    expect(normalizePhone("+442071234567")).toEqual({
      valid: true,
      normalized: "+442071234567",
    });
  });

  it("rejects garbage", () => {
    expect(normalizePhone("123").valid).toBe(false);
  });
});

describe("isPakistaniMobile", () => {
  it("matches the strict validator", () => {
    expect(isPakistaniMobile("03001234567")).toBe(true);
    expect(isPakistaniMobile("+442071234567")).toBe(false);
  });
});
