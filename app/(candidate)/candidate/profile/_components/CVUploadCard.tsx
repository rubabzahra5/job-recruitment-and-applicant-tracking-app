"use client";

import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface ParsedData {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experienceYears: number | null;
  warnings: string[];
}

/**
 * CV upload with auto-fill.
 * Uploads PDF/DOCX/TXT, extracts data, and shows what was found.
 * User reviews and confirms before applying to profile.
 */
export function CVUploadCard({ hasCurrentCv }: { hasCurrentCv: boolean }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParsedData | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setParsed(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("cv", file);

      const res = await fetch("/api/candidate/cv-upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!result.ok) {
        setError(result.error ?? "Upload failed.");
        return;
      }

      setParsed(result.parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload CV & Auto-fill Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Upload your CV (PDF, DOCX, or TXT — max 5MB). We&apos;ll extract your
          name, contact info, skills, and experience to pre-fill your profile.
          You&apos;ll review everything before it&apos;s saved.
        </p>

        {hasCurrentCv && (
          <Alert tone="info">
            You already have a CV on file. Uploading a new one will replace it.
          </Alert>
        )}

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.doc"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            isLoading={uploading}
          >
            {uploading ? "Uploading & parsing…" : "Upload & parse"}
          </Button>
        </div>

        {file && (
          <p className="text-xs text-slate-500">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        {parsed && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h4 className="font-semibold text-emerald-900">What we found in your CV:</h4>
            <dl className="mt-2 space-y-1 text-sm">
              {parsed.fullName && (
                <div><dt className="inline font-medium">Name:</dt> <dd className="inline">{parsed.fullName}</dd></div>
              )}
              {parsed.email && (
                <div><dt className="inline font-medium">Email:</dt> <dd className="inline">{parsed.email}</dd></div>
              )}
              {parsed.phone && (
                <div><dt className="inline font-medium">Phone:</dt> <dd className="inline">{parsed.phone}</dd></div>
              )}
              {parsed.experienceYears !== null && (
                <div><dt className="inline font-medium">Experience:</dt> <dd className="inline">{parsed.experienceYears} years</dd></div>
              )}
              {parsed.skills.length > 0 && (
                <div>
                  <dt className="font-medium">Skills ({parsed.skills.length}):</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {parsed.skills.map((s) => (
                      <span key={s} className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        {s}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            {parsed.warnings.length > 0 && (
              <div className="mt-3">
                {parsed.warnings.map((w, i) => (
                  <Alert key={i} tone="warning">{w}</Alert>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-emerald-700">
              ✓ CV uploaded successfully. Review the extracted info above — you can
              manually adjust your profile fields below.
            </p>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Supported formats: PDF, DOCX, TXT. Old .doc files are not supported —
          please convert to .docx or .pdf.
        </p>
      </CardContent>
    </Card>
  );
}
