import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron job: auto-pause stale jobs (ghost-job prevention).
 * Runs daily via Vercel Cron (see vercel.json).
 * 
 * Security: requires CRON_SECRET bearer token (set in Vercel env vars).
 * Pakistan-first: skipped entirely when disruption_mode is active.
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this automatically, but we check manually for safety).
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Pakistan-first: never auto-pause during internet disruptions.
  const { data: disruption } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "disruption_mode")
    .maybeSingle();
  
  if (disruption && (disruption.value as boolean) === true) {
    return NextResponse.json({
      skipped: true,
      reason: "Disruption mode active — auto-pause frozen",
    });
  }

  // Run the auto-pause function (pauses jobs inactive for 30+ days).
  const { data, error } = await admin.rpc("auto_pause_stale_jobs", {
    inactivity_days: 30,
  });

  if (error) {
    console.error("[cron/auto-pause] Failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const paused = (data ?? []) as Array<{ job_id: string; job_title: string }>;
  
  // Log to audit trail.
  await admin.from("audit_logs").insert({
    actor_user_id: null, // system action
    action: "cron.auto_pause_stale",
    entity_type: "job",
    metadata: { pausedCount: paused.length, paused: paused.map(p => ({ id: p.job_id, title: p.job_title })) },
  });

  return NextResponse.json({
    success: true,
    pausedCount: paused.length,
    paused: paused.map(p => p.job_title),
  });
}

// Vercel Cron calls GET; also allow POST for manual triggers.
export const POST = GET;

// Don't cache cron responses.
export const dynamic = "force-dynamic";
