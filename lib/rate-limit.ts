import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Buckets that protect credential endpoints fail CLOSED when the
 * limiter's database check errors (SEC-11): if we cannot verify the
 * attempt count for a login, we refuse the attempt rather than letting
 * brute force through during an outage. All other buckets fail OPEN,
 * as documented on checkRateLimit below.
 */
const FAIL_CLOSED_BUCKETS = new Set(["login", "admin_login"]);

/**
 * Simple rate limiter using Supabase as the store (free-tier friendly,
 * no Redis needed). Works across Vercel serverless instances.
 *
 * Usage:
 *   const { allowed, retryAfterSec } = await checkRateLimit("login", ip, 5, 60);
 *   if (!allowed) throw new Error(`Too many attempts. Try again in ${retryAfterSec}s.`);
 *
 * Failure behaviour on a database error (SEC-11): buckets in
 * FAIL_CLOSED_BUCKETS ("login", "admin_login") return allowed:false;
 * every other bucket fails open so a limiter outage cannot block
 * legitimate non-credential traffic platform-wide.
 *
 * @param bucket - Action category (e.g. 'login', 'apply', 'invite')
 * @param key - Unique key (IP, user_id, etc.)
 * @param maxHits - Max allowed hits in the window
 * @param windowSec - Window size in seconds
 */
export async function checkRateLimit(
  bucket: string,
  key: string,
  maxHits: number,
  windowSec: number,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - windowSec * 1000).toISOString();

  // Count hits in the window.
  const { count, error } = await admin
    .from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("key", key)
    .gte("created_at", windowStart);

  if (error) {
    // Log the error for monitoring, then apply the bucket's failure mode:
    // credential buckets fail closed (SEC-11), everything else fails open
    // (don't block legitimate users if the table is missing/broken).
    console.error(`[rate-limit] check failed for ${bucket}:${key}:`, error.message);
    if (FAIL_CLOSED_BUCKETS.has(bucket)) {
      return { allowed: false, retryAfterSec: 60 };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  if ((count ?? 0) >= maxHits) {
    // Find oldest hit in window to compute retry-after.
    const { data } = await admin
      .from("rate_limit_hits")
      .select("created_at")
      .eq("bucket", bucket)
      .eq("key", key)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const oldest = data?.created_at ? new Date(data.created_at as string).getTime() : Date.now();
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowSec * 1000 - Date.now()) / 1000));
    return { allowed: false, retryAfterSec };
  }

  // Record this hit.
  await admin.from("rate_limit_hits").insert({ bucket, key });
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Get client IP from request headers (for rate limiting by IP).
 * Works with Vercel, Cloudflare, and direct connections.
 *
 * TRUST ASSUMPTION (SEC-14): this trusts the first X-Forwarded-For
 * entry. That is correct on Vercel, where the platform sets the header
 * and clients cannot spoof it. If the app is ever served behind a
 * different proxy (or directly), the header becomes client-controlled
 * and every IP-keyed limit could be bypassed by rotating it — revisit
 * this function before any hosting change.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
