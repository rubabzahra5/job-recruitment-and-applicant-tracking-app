import { describe, expect, it } from "vitest";
import {
  MAX_AVATAR_BYTES,
  MAX_CV_BYTES,
  randomObjectPath,
  sniffDocMime,
  validateDocUpload,
} from "@/lib/uploads";

/**
 * Upload security tests — complements tests/uploads.test.ts with
 * adversarial cases: fake PDF headers, oversized files, path randomization.
 */

const PDF_HEAD = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
// "%PDX" — one byte off a real PDF header.
const FAKE_PDF_HEAD = new Uint8Array([0x25, 0x50, 0x44, 0x58, 0x2d, 0x31, 0x2e, 0x34]);
const TEXT_HEAD = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77]); // "hello w"
const SHORT = new Uint8Array([0x25, 0x50]); // truncated magic

describe("sniffDocMime — adversarial headers", () => {
  it("rejects a near-miss PDF header (%PDX)", () => {
    expect(sniffDocMime(FAKE_PDF_HEAD)).toBeNull();
  });

  it("rejects plain text content", () => {
    expect(sniffDocMime(TEXT_HEAD)).toBeNull();
  });

  it("rejects truncated magic bytes", () => {
    expect(sniffDocMime(SHORT)).toBeNull();
  });
});

describe("validateDocUpload — spoofed content", () => {
  it("rejects a .pdf whose content is not a PDF", () => {
    const res = validateDocUpload({
      fileName: "cv.pdf",
      sizeBytes: 1024,
      headBytes: FAKE_PDF_HEAD,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/does not look like/i);
  });

  it("rejects a text file renamed to .pdf", () => {
    const res = validateDocUpload({
      fileName: "notes.pdf",
      sizeBytes: 64,
      headBytes: TEXT_HEAD,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects a file with no extension", () => {
    const res = validateDocUpload({
      fileName: "cv",
      sizeBytes: 1024,
      headBytes: PDF_HEAD,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Only PDF and DOCX/i);
  });
});

describe("validateDocUpload — size limits", () => {
  it("rejects files over the 10 MB CV cap", () => {
    const res = validateDocUpload({
      fileName: "huge.pdf",
      sizeBytes: MAX_CV_BYTES + 1,
      headBytes: PDF_HEAD,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/10 MB/);
  });

  it("accepts a file exactly at the cap", () => {
    const res = validateDocUpload({
      fileName: "edge.pdf",
      sizeBytes: MAX_CV_BYTES,
      headBytes: PDF_HEAD,
    });
    expect(res.ok).toBe(true);
  });

  it("honors a caller-supplied smaller cap (avatar 2 MB)", () => {
    const res = validateDocUpload({
      fileName: "photo.pdf",
      sizeBytes: MAX_AVATAR_BYTES + 1,
      headBytes: PDF_HEAD,
      maxBytes: MAX_AVATAR_BYTES,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/2 MB/);
  });
});

describe("validateDocUpload — extension handling", () => {
  it("accepts uppercase extensions", () => {
    const res = validateDocUpload({
      fileName: "CV.PDF",
      sizeBytes: 1024,
      headBytes: PDF_HEAD,
    });
    expect(res.ok).toBe(true);
    expect(res.mime).toBe("application/pdf");
  });

  it("derives the extension from the final segment only", () => {
    const res = validateDocUpload({
      fileName: "archive.tar.pdf",
      sizeBytes: 1024,
      headBytes: PDF_HEAD,
    });
    expect(res.ok).toBe(true);
  });
});

describe("randomObjectPath — unpredictability", () => {
  it("generates unique paths across many calls", () => {
    const paths = new Set(
      Array.from({ length: 50 }, () =>
        randomObjectPath("cvs", "user-123", "application/pdf"),
      ),
    );
    expect(paths.size).toBe(50);
  });

  it("never embeds the original filename", () => {
    const p = randomObjectPath("cvs", "user-123", "application/pdf");
    const segments = p.split("/");
    expect(segments).toHaveLength(3);
    expect(segments[0]).toBe("cvs");
    expect(segments[1]).toBe("user-123");
    // Final segment is exactly <uuid>.pdf — no room for the original name.
    expect(segments[2]).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it("keeps the bucket prefix caller-controlled and user-scoped", () => {
    const p = randomObjectPath(
      "cvs",
      "user-123",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(p.startsWith("cvs/user-123/")).toBe(true);
    expect(p.endsWith(".docx")).toBe(true);
  });
});
