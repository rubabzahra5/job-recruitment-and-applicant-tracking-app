/**
 * Phone number helpers.
 *
 * Pakistani mobile formats accepted:
 *   03XXXXXXXXX        (11 digits, leading 0)
 *   +923XXXXXXXXX      (E.164 with +)
 *   923XXXXXXXXX       (E.164 without +)
 *
 * IMPORTANT: validation never assumes every user has a Pakistani number.
 * `normalizePhone()` accepts any plausible international number in E.164-ish
 * form (or empty, returning null). Use `validatePakistaniMobile()` only for
 * fields that are explicitly documented as "Pakistani mobile required"
 * (e.g. SMS OTP delivery), and keep such fields optional wherever possible.
 */

export interface PhoneValidation {
  valid: boolean;
  /** Canonical E.164 form (+923001234567) when valid, else null. */
  normalized: string | null;
  error?: string;
}

const PK_MOBILE_LOCAL = /^03\d{9}$/;
const PK_MOBILE_INTL = /^\+?923\d{9}$/;

function stripSeparators(raw: string): string {
  return raw.replace(/[\s\-().]/g, "");
}

/**
 * Strict Pakistani mobile validation. Returns canonical +92… form.
 */
export function validatePakistaniMobile(raw: string): PhoneValidation {
  const cleaned = stripSeparators(raw.trim());
  if (PK_MOBILE_LOCAL.test(cleaned)) {
    return { valid: true, normalized: `+92${cleaned.slice(1)}` };
  }
  if (PK_MOBILE_INTL.test(cleaned)) {
    const digits = cleaned.replace(/^\+/, "");
    return { valid: true, normalized: `+${digits}` };
  }
  return {
    valid: false,
    normalized: null,
    error: "Enter a valid Pakistani mobile number (e.g. 03001234567).",
  };
}

/**
 * Lenient general phone normalization for optional phone fields:
 * - empty/blank -> { valid: true, normalized: null }
 * - Pakistani mobiles -> canonical +92… form
 * - other international numbers starting with + and 7–15 digits -> kept as-is
 * - anything else -> invalid
 */
export function normalizePhone(raw: string | null | undefined): PhoneValidation {
  if (raw == null || raw.trim() === "") {
    return { valid: true, normalized: null };
  }
  const pk = validatePakistaniMobile(raw);
  if (pk.valid) return pk;

  const cleaned = stripSeparators(raw.trim());
  if (/^\+\d{7,15}$/.test(cleaned)) {
    return { valid: true, normalized: cleaned };
  }
  return {
    valid: false,
    normalized: null,
    error: "Enter a valid phone number, e.g. 03001234567 or +442071234567.",
  };
}

/** Quick check: does this look like a Pakistani mobile (any accepted format)? */
export function isPakistaniMobile(raw: string): boolean {
  return validatePakistaniMobile(raw).valid;
}
