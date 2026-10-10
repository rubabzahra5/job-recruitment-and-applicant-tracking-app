import { describe, expect, it } from "vitest";
import {
  MAX_CV_BYTES,
  randomObjectPath,
  sniffDocMime,
  validateDocUpload,
} from "@/lib/uploads";

const PDF_HEAD = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const DOCX_HEAD = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]); // PK..
const EXE_HEAD = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ

describe("sniffDocMime", () => {
  it("detects PDF magic bytes", () => {
    expect(sniffDocMime(PDF_HEAD)).toBe("application/pdf");
  });

  it("detects DOCX (zip) magic bytes", () => {
    expect(sniffDocMime(DOCX_HEAD)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("returns null for unknown content", () => {
    expect(sniffDocMime(EXE_HEAD)).toBeNull();
    expect(sniffDocMime(new Uint8Array([]))).toBeNull();
  });
});

describe("validateDocUpload", () => {
  it("accepts a real PDF", () => {
    const res = validateDocUpload({ fileName: "cv.pdf", sizeBytes: 1024, headBytes: PDF_HEAD });
    expect(res).toEqual({ ok: true, mime: "application/pdf" });
  });

  it("accepts a real DOCX", () => {
    const res = validateDocUpload({ fileName: "cv.docx", sizeBytes: 2048, headBytes: DOCX_HEAD });
    expect(res.ok).toBe(true);
  });

  it("rejects a PDF extension with non-PDF content", () => {
    const res = validateDocUpload({ fileName: "evil.pdf", sizeBytes: 1024, headBytes: EXE_HEAD });
    expect(res.ok).toBe(false);
  });

  it("rejects mismatched extension and content", () => {
    const res = validateDocUpload({ fileName: "cv.docx", sizeBytes: 1024, headBytes: PDF_HEAD });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/extension/i);
  });

  it("rejects disallowed extensions", () => {
    const res = validateDocUpload({ fileName: "run.exe", sizeBytes: 1024, headBytes: EXE_HEAD });
    expect(res.ok).toBe(false);
  });

  it("enforces the size limit", () => {
    const res = validateDocUpload({
      fileName: "big.pdf",
      sizeBytes: MAX_CV_BYTES + 1,
      headBytes: PDF_HEAD,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/exceeds/);
  });

  it("rejects empty files", () => {
    const res = validateDocUpload({ fileName: "cv.pdf", sizeBytes: 0, headBytes: PDF_HEAD });
    expect(res.ok).toBe(false);
  });
});

describe("randomObjectPath", () => {
  it("builds user-scoped randomized paths", () => {
    const a = randomObjectPath("cvs", "user-123", "application/pdf");
    const b = randomObjectPath("cvs", "user-123", "application/pdf");
    expect(a).toMatch(/^cvs\/user-123\/[0-9a-f-]{36}\.pdf$/);
    expect(a).not.toBe(b); // randomized
  });

  it("uses docx extension for docx mime", () => {
    const p = randomObjectPath(
      "cvs",
      "user-123",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(p.endsWith(".docx")).toBe(true);
  });
});
