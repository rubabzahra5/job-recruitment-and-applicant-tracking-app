/**
 * Upload validation + storage-path conventions.
 *
 * - Allowlist: PDF and DOCX only (CVs, cover letters).
 * - Magic-byte sniffing: never trust the client-provided MIME type or
 *   extension alone.
 * - Object names are randomized (crypto.randomUUID) under a user-scoped
 *   prefix, e.g. `cvs/{user_id}/{uuid}.pdf`.
 */

export const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB

export type AllowedDocMime =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const EXT_TO_MIME: Record<string, AllowedDocMime> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Sniff the MIME type from magic bytes.
 * PDF  -> 25 50 44 46 ("%PDF")
 * DOCX -> 50 4B 03 04 (ZIP local file header; .docx is a ZIP archive)
 */
export function sniffDocMime(bytes: Uint8Array): AllowedDocMime | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

export interface UploadValidation {
  ok: boolean;
  error?: string;
  mime?: AllowedDocMime;
}

export interface UploadInput {
  fileName: string;
  sizeBytes: number;
  headBytes: Uint8Array; // first bytes of the file for magic-byte sniffing
  maxBytes?: number;
}

/**
 * Validate an upload: size limit, allowlisted extension, and magic bytes.
 * The extension must agree with the sniffed type — a `.pdf` that is not
 * really a PDF is rejected.
 */
export function validateDocUpload(input: UploadInput): UploadValidation {
  const maxBytes = input.maxBytes ?? MAX_CV_BYTES;
  if (input.sizeBytes <= 0) {
    return { ok: false, error: "File is empty." };
  }
  if (input.sizeBytes > maxBytes) {
    return {
      ok: false,
      error: `File exceeds the ${(maxBytes / (1024 * 1024)).toFixed(0)} MB limit.`,
    };
  }
  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  const expectedMime = EXT_TO_MIME[ext];
  if (!expectedMime) {
    return { ok: false, error: "Only PDF and DOCX files are allowed." };
  }
  const sniffed = sniffDocMime(input.headBytes);
  if (!sniffed) {
    return { ok: false, error: "File content does not look like a PDF or DOCX." };
  }
  if (sniffed !== expectedMime) {
    return { ok: false, error: "File extension does not match its content." };
  }
  return { ok: true, mime: sniffed };
}

const MIME_TO_EXT: Record<AllowedDocMime, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * Build a randomized, user-scoped storage object path.
 * Convention: `{bucket}/{user_id}/{uuid}.{ext}` — e.g. `cvs/{user_id}/{uuid}.pdf`.
 * Randomized names prevent enumeration and collisions.
 */
export function randomObjectPath(
  bucket: string,
  userId: string,
  mime: AllowedDocMime,
): string {
  const ext = MIME_TO_EXT[mime];
  return `${bucket}/${userId}/${crypto.randomUUID()}.${ext}`;
}
