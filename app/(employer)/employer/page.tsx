import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Employer Dashboard" };

export default async function EmployerDashboardPage() {
  const user = await getSessionUser();

  return (
    <main>
      <h1 className="text-2xl font-bold">Employer dashboard</h1>
      <p className="mt-2 text-slate-600">
        {user ? (
          <>
            Signed in as <span className="font-medium">{user.email}</span>. Job
            postings, applicants and interviews will be managed here.
          </>
        ) : (
          "Sign in to manage your hiring."
        )}
      </p>
    </main>
  );
}
