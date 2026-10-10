import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Runs with the caller's session, so Row Level Security applies.
 * Use in server components, server actions and route handlers.
 *
 * NOTE: `cookies()` is awaited BEFORE env validation on purpose. Reading the
 * cookie store opts the page into dynamic rendering, so `next build` never
 * executes the env check at build time. Env is still validated fail-fast:
 * at server startup (instrumentation.ts) and on first request-time use.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a server component (read-only cookies). The middleware
          // refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
