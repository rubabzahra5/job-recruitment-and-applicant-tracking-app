import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Candidate Dashboard" };

export default async function CandidateDashboardPage() {
  // Server-side authorization: page-level guard; finer checks live in actions.
  const user = await getSessionUser();

  return (
    <main>
      <h1 className="text-2xl font-bold">Candidate dashboard</h1>
      <p className="mt-2 text-slate-600">
        {user ? (
          <>
            Signed in as <span className="font-medium">{user.email}</span>. Your
            applications, saved jobs and profile tools will live here.
          </>
        ) : (
          "Sign in to manage your applications."
        )}
      </p>
    </main>
  );
}
