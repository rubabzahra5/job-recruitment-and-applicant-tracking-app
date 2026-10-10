import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getEnv, getServiceRoleKey } from "@/lib/env";

/**
 * Privileged Supabase client using the service-role key.
 *
 * SERVER ONLY — the `server-only` import above makes any accidental client
 * bundle fail at build time, and getServiceRoleKey() throws without the key.
 *
 * Bypasses Row Level Security: use only in trusted server code (server
 * actions / route handlers / scripts) AFTER performing your own
 * authorization checks via lib/rbac.ts.
 */
export function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    getServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
