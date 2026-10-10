"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (anon key only).
 * Use inside client components. Never import the service-role key here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
