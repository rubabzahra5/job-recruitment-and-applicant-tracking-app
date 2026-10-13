import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Simple rate limiter using Supabase as the store (free-tier friendly,
 * no Redis needed). Works across Vercel serverless instances.
 *
 * Usage:
 *   const { allowed, retryAfterSec } = await checkRateLimit("login", ip, 5, 60);
 *   if (!allowed) throw new Error(`Too many attempts. Try again in ${retryAfterSec}s.`);
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
    // Fail open on DB error (don't block legitimate users if table missing).
    // Log the error for monitoring.
    console.error(`[rate-limit] check failed for ${bucket}:${key}:`, error.message);
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
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
