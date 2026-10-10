import { z } from "zod";

/**
 * Central environment validation.
 *
 * - Validated lazily on first access and cached: safe to import at module
 *   scope during `next build` (no validation runs until something actually
 *   reads a value at request/startup time).
 * - `validateEnv()` is called from instrumentation.ts so a misconfigured
 *   server fails fast at boot.
 * - Error messages name the offending VARIABLES ONLY. Secret values are never
 *   echoed, logged, or embedded in thrown errors.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, "required")
    .refine((v) => v.startsWith("https://"), "must be an https URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SEED_CONFIRM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Validate process.env once, cache the result, and return it. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    // Deliberately generic: never include received values (they may be secrets).
    throw new Error(
      `Invalid environment configuration. Check the following variables and see .env.example: ${keys.join(", ")}`,
    );
  }
  cached = parsed.data;
  return cached;
}

/** Fail fast with a clear, secret-free error when configuration is invalid. */
export function validateEnv(): Env {
  return getEnv();
}

/** True when both pieces needed to send email are configured. */
export function isEmailConfigured(env: Env = getEnv()): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM_ADDRESS);
}

/** Server-only secrets must never be read from client components. */
export function getServiceRoleKey(): string {
  const key = getEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. See .env.example.",
    );
  }
  return key;
}
