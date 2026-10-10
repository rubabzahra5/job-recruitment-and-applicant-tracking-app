import type { Metadata } from "next";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { ResumeManager } from "./_components/ResumeManager";
import { listCvs } from "./_actions";

export const metadata: Metadata = { title: "My Resume" };

export default async function ResumePage() {
  await requireCandidate();
  const documents = await listCvs();

  return (
    <main>
      <h1 className="text-2xl font-bold tracking-tight">Resume</h1>
      <p className="mt-1 text-sm text-slate-600">
        Upload and manage your CVs. The CV marked <strong>Current</strong> is
        pre-selected when you apply. CVs attached to active applications can&apos;t
        be deleted until those applications are withdrawn.
      </p>
      <div className="mt-6">
        <ResumeManager documents={documents} />
      </div>
    </main>
  );
}
