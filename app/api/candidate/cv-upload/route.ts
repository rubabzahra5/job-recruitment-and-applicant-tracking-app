import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/auth";
import { parseCV } from "@/lib/cv-parser";
import { validateDocUpload, MAX_CV_BYTES } from "@/lib/uploads";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Upload a CV and auto-extract data for profile auto-fill.
 *
 * Accepts: PDF and DOCX only, validated by content (magic bytes) via
 * lib/uploads.ts — the same validation the resume action uses (SEC-09).
 * The client-supplied MIME type is never trusted; the sniffed type is
 * what gets stored. Rate-limited per candidate (SEC-09).
 * Returns parsed data (name, email, phone, skills, experience).
 */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();

    // Rate limit per signed-in candidate: 10 uploads/hour.
    const { allowed } = await checkRateLimit("cv_upload", user.id, 10, 3600);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many uploads. Please try again later." },
        { status: 429 },
      );
    }

    const admin = createAdminClient();

    const formData = await request.formData();
    const file = formData.get("cv") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file uploaded." }, { status: 400 });
    }

    // Validate size, extension and magic bytes (PDF/DOCX only) — the
    // file's head bytes decide, exactly as in the resume action.
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateDocUpload({
      fileName: file.name,
      sizeBytes: file.size,
      headBytes: buffer.subarray(0, 4096),
      maxBytes: MAX_CV_BYTES,
    });
    if (!validation.ok || !validation.mime) {
      return NextResponse.json(
        { ok: false, error: validation.error ?? "Please upload a PDF or DOCX file." },
        { status: 400 },
      );
    }

    // Get candidate profile.
    const { data: profile } = await admin
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Candidate profile not found." },
        { status: 404 }
      );
    }

    // Parse the CV.
    const parsed = await parseCV(buffer, file.name);

    // Upload to storage (cvs bucket).
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${user.id}/${timestamp}-${safeName}`;

    const { error: uploadError } = await admin.storage
      .from("cvs")
      .upload(storagePath, buffer, {
        contentType: validation.mime,
        upsert: false,
      });

    if (uploadError) {
      // SEC-12: log the detail server-side; generic message to the client.
      console.error("[cv-upload] Storage upload failed:", uploadError.message);
      return NextResponse.json(
        { ok: false, error: "Upload failed. Please try again." },
        { status: 500 }
      );
    }

    // Mark old CVs as not current, save new one.
    await admin
      .from("candidate_documents")
      .update({ is_current_cv: false })
      .eq("profile_id", (profile as any).id)
      .eq("kind", "cv");

    const { data: doc, error: docError } = await admin
      .from("candidate_documents")
      .insert({
        profile_id: (profile as any).id,
        kind: "cv",
        file_path: storagePath,
        file_name: file.name,
        mime_type: validation.mime,
        file_size: file.size,
        is_current_cv: true,
      })
      .select("id")
      .single();

    if (docError) {
      // Clean up uploaded file.
      await admin.storage.from("cvs").remove([storagePath]);
      // SEC-12: log the detail server-side; generic message to the client.
      console.error("[cv-upload] Failed to save CV record:", docError.message);
      return NextResponse.json(
        { ok: false, error: "Upload failed. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      documentId: (doc as any).id,
      parsed: {
        fullName: parsed.fullName,
        email: parsed.email,
        phone: parsed.phone,
        skills: parsed.skills,
        experienceYears: parsed.experienceYears,
        warnings: parsed.warnings,
      },
    });
  } catch (e) {
    // SEC-12: log the detail server-side; generic message to the client.
    console.error("[cv-upload] Upload failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { ok: false, error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
