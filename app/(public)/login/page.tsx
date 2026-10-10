import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "../_components/LoginForm";
import { getDashboardPath, safeNextPath } from "../_lib/dashboard";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your Job Recruitment And Applicant Tracking System account.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = safeNextPath(rawNext) ?? undefined;

  // Already signed in — send them to their dashboard.
  const user = await getSessionUser();
  if (user) {
    if (next) redirect(next);
    let dashboard = "/candidate";
    try {
      dashboard = await getDashboardPath(user.id);
    } catch {
      // default stands
    }
    redirect(dashboard);
  }

  const message = Array.isArray(sp.message) ? sp.message[0] : sp.message;
  const verified = sp.verified === "1" || (Array.isArray(sp.verified) && sp.verified[0] === "1");

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1 text-slate-600">Log in to continue to Job Recruitment And Applicant Tracking System.</p>

      <Card className="mt-6 p-6">
        {message === "password-updated" && (
          <div className="mb-4">
            <Alert tone="success" title="Password updated">
              Your password has been changed. Please log in with your new password.
            </Alert>
          </div>
        )}
        {verified && (
          <div className="mb-4">
            <Alert tone="success" title="Email verified">
              Your email is verified — log in to get started.
            </Alert>
          </div>
        )}
        {next && (
          <div className="mb-4">
            <Alert tone="info">Please log in to continue.</Alert>
          </div>
        )}
        <LoginForm next={next} />
      </Card>
    </main>
  );
}
