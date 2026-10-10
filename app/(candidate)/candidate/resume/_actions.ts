"use server";

import { revalidatePath } from "next/cache";
import {
  requireCandidate,
  getOrCreateCandidateProfile,
  storageObjectName,
} from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateDocUpload, randomObjectPath, MAX_CV_BYTES } from "@/lib/uploads";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

export interface CvDocument {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  is_current_cv: boolean;
  created_at: string;
  storage_path: string;
}

/** The candidate's own CV documents, newest first. */
export async function listCvs(): Promise<CvDocument[]> {
  const user = await requireCandidate();
  const profile = await getOrCreateCandidateProfile(user.id);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("candidate_documents")
    .select("id,file_name,mime_type,size_bytes,is_current_cv,created_at,storage_path")
    .eq("profile_id", profile.id)
    .eq("kind", "cv")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list CVs: ${error.message}`);
  return (data ?? []) as CvDocument[];
}

async function requireOwnedCv(documentId: string) {
  const user = await requireCandidate();
  const profile = await getOrCreateCandidateProfile(user.id);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("candidate_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load document: ${error.message}`);
  const doc = data as (CvDocument & { profile_id: string }) | null;
  if (!doc || doc.profile_id !== profile.id) {
    throw new Error("Document not found.");
  }
  return { admin, doc, profileId: profile.id };
}

/**
 * Upload a CV (PDF/DOCX only). Validates size, extension and magic bytes via
 * lib/uploads.ts; stores under a randomized user-scoped path in the `cvs`
 * bucket and records a candidate_documents row.
 */
export async function uploadCv(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireCandidate();
    const profile = await getOrCreateCandidateProfile(user.id);

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("Choose a PDF or DOCX file to upload.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateDocUpload({
      fileName: file.name,
      sizeBytes: file.size,
      headBytes: bytes.slice(0, 4096),
      maxBytes: MAX_CV_BYTES,
    });
    if (!validation.ok || !validation.mime) {
      return fail(validation.error ?? "This file can't be used as a CV.");
    }

    const fullPath = randomObjectPath("cvs", user.id, validation.mime);
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("cvs")
      .upload(storageObjectName(fullPath), bytes, {
        contentType: validation.mime,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { count } = await admin
      .from("candidate_documents")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("kind", "cv");
    const makeCurrent =
      formData.get("makeCurrent") === "on" || (count ?? 0) === 0;
    if (makeCurrent) {
      await admin
        .from("candidate_documents")
        .update({ is_current_cv: false })
        .eq("profile_id", profile.id)
        .eq("kind", "cv");
    }

    const { error: insertError } = await admin.from("candidate_documents").insert({
      profile_id: profile.id,
      storage_path: fullPath,
      file_name: file.name.slice(0, 255),
      mime_type: validation.mime,
      size_bytes: file.size,
      kind: "cv",
      is_current_cv: makeCurrent,
    });
    if (insertError) {
      // Roll back the orphaned object so storage doesn't fill with junk.
      await admin.storage.from("cvs").remove([storageObjectName(fullPath)]);
      throw new Error(`Failed to save CV record: ${insertError.message}`);
    }

    revalidatePath("/candidate/resume");
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Upload failed.");
  }
}

/** Mark one of the candidate's CVs as the current (default) CV. */
export async function setCurrentCv(documentId: string): Promise<ActionResult> {
  try {
    const { admin, profileId } = await requireOwnedCv(documentId);
    await admin
      .from("candidate_documents")
      .update({ is_current_cv: false })
      .eq("profile_id", profileId)
      .eq("kind", "cv");
    const { error } = await admin
      .from("candidate_documents")
      .update({ is_current_cv: true })
      .eq("id", documentId);
    if (error) throw new Error(`Failed to set current CV: ${error.message}`);
    revalidatePath("/candidate/resume");
    revalidatePath("/candidate/profile");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to set current CV.");
  }
}

/**
 * Delete a CV. Blocked when the CV is attached to any non-withdrawn
 * application (application_documents snapshots reference the same storage
 * path) — deleting it would break the employer's view of a live application.
 * The storage object itself is only removed when no application snapshot
 * references the path, so retained applications keep working.
 */
export async function deleteCv(documentId: string): Promise<ActionResult> {
  try {
    const { admin, doc } = await requireOwnedCv(documentId);

    const { data: liveRefs, error: refsError } = await admin
      .from("application_documents")
      .select("id,application:applications!inner(withdrawn_at)")
      .eq("storage_path", doc.storage_path)
      .is("application.withdrawn_at", null);
    if (refsError) throw new Error(`Failed to check CV usage: ${refsError.message}`);
    if (liveRefs && liveRefs.length > 0) {
      return fail(
        `This CV can't be deleted because it's attached to ${liveRefs.length} active application${liveRefs.length === 1 ? "" : "s"}. ` +
          "Withdraw those applications first, or replace it as your current CV instead — your submitted applications keep their own copy.",
      );
    }

    // Only remove the stored file when no application snapshot needs it.
    const { count: snapshotCount } = await admin
      .from("application_documents")
      .select("id", { count: "exact", head: true })
      .eq("storage_path", doc.storage_path);
    if ((snapshotCount ?? 0) === 0) {
      await admin.storage.from("cvs").remove([storageObjectName(doc.storage_path)]);
    }

    const { error: deleteError } = await admin
      .from("candidate_documents")
      .delete()
      .eq("id", documentId);
    if (deleteError) throw new Error(`Failed to delete CV: ${deleteError.message}`);

    if (doc.is_current_cv) {
      const { data: remaining } = await admin
        .from("candidate_documents")
        .select("id")
        .eq("profile_id", doc.profile_id)
        .eq("kind", "cv")
        .order("created_at", { ascending: false })
        .limit(1);
      const next = (remaining?.[0] ?? null) as { id: string } | null;
      if (next) {
        await admin
          .from("candidate_documents")
          .update({ is_current_cv: true })
          .eq("id", next.id);
      }
    }

    revalidatePath("/candidate/resume");
    revalidatePath("/candidate/profile");
    revalidatePath("/candidate");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to delete CV.");
  }
}
