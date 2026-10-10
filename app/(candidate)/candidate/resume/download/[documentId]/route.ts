import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isCandidate } from "@/lib/rbac";
import {
  getCandidateProfile,
  createCvSignedUrl,
} from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /candidate/resume/download/[documentId]
 * Ownership-checked CV download: verifies the document belongs to the signed-in
 * candidate, then redirects to a short-lived (2 min) signed URL. The raw
 * storage URL is never exposed and staff never get direct storage access.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
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

  const { documentId } = await params;
  const profile = await getCandidateProfile(user.id);
  if (!profile) return new NextResponse("Not found", { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("candidate_documents")
    .select("id,storage_path,profile_id")
    .eq("id", documentId)
    .maybeSingle();
  if (error) return new NextResponse("Failed to load document", { status: 500 });
  const doc = data as { id: string; storage_path: string; profile_id: string } | null;
  if (!doc || doc.profile_id !== profile.id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const signedUrl = await createCvSignedUrl(doc.storage_path, 120);
  return NextResponse.redirect(signedUrl);
}
