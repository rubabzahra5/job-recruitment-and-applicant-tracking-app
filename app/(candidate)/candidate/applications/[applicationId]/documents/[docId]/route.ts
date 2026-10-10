import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isCandidate } from "@/lib/rbac";
import { createCvSignedUrl } from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /candidate/applications/[applicationId]/documents/[docId]
 * Download a CV snapshot attached to the candidate's own application.
 * Verifies application ownership (user_id = auth.uid()) before issuing a
 * short-lived signed URL.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ applicationId: string; docId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(new URL(request.url).pathname)}`, request.url),
    );
  }
  if (!(await isCandidate(user.id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { applicationId, docId } = await params;
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return new NextResponse("Not found", { status: 404 });

  const { data: doc } = await admin
    .from("application_documents")
    .select("id,storage_path")
    .eq("id", docId)
    .eq("application_id", applicationId)
    .maybeSingle();
  const row = doc as { id: string; storage_path: string } | null;
  if (!row) return new NextResponse("Not found", { status: 404 });

  const signedUrl = await createCvSignedUrl(row.storage_path, 120);
  return NextResponse.redirect(signedUrl);
}
