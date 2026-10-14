import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/auth";
import { parseCV } from "@/lib/cv-parser";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/msword", // .doc (will warn, not parse)
];

/**
 * Upload a CV and auto-extract data for profile auto-fill.
 * 
 * Accepts: PDF, DOCX, TXT (and .doc with a warning).
 * Returns parsed data (name, email, phone, skills, experience).
 */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const admin = createAdminClient();

    const formData = await request.formData();
    const file = formData.get("cv") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file uploaded." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: "File too large. Maximum 5MB." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Please upload a PDF, DOCX, or TXT file." },
        { status: 400 }
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
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseCV(buffer, file.name);

    // Upload to storage (cvs bucket).
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${user.id}/${timestamp}-${safeName}`;

    const { error: uploadError } = await admin.storage
      .from("cvs")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: `Upload failed: ${uploadError.message}` },
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
        mime_type: file.type,
        file_size: file.size,
        is_current_cv: true,
      })
      .select("id")
      .single();

    if (docError) {
      // Clean up uploaded file.
      await admin.storage.from("cvs").remove([storagePath]);
      throw new Error(docError.message);
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
    const message = e instanceof Error ? e.message : "Upload failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
