import type { Metadata } from "next";
import Link from "next/link";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { SavedJobCard } from "./_components/SavedJobCard";
import { listSavedJobs } from "./_actions";

export const metadata: Metadata = { title: "Saved Jobs" };

export default async function SavedJobsPage() {
  await requireCandidate();
  const saved = await listSavedJobs();

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saved jobs</h1>
          <p className="mt-1 text-sm text-slate-600">
            {saved.length} job{saved.length === 1 ? "" : "s"} saved for later.
          </p>
        </div>
        <Link href="/jobs">
          <Button variant="primary">Browse jobs</Button>
        </Link>
      </div>

      <div className="mt-6">
        {saved.length === 0 ? (
          <EmptyState
            title="No saved jobs"
            description="Save jobs from the job board to revisit them here."
            action={
              <Link href="/jobs">
                <Button variant="primary" size="sm">Browse jobs</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {saved.map((s) => (
              <li key={s.id}>
                <SavedJobCard saved={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
