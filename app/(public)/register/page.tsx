import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "../_components/RegisterForm";
import { getDashboardPath, safeNextPath } from "../_lib/dashboard";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Register a free HirePakistan account as a job seeker or employer.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;

  // Already signed in — send them to their dashboard.
  const user = await getSessionUser();
  if (user) {
    let dashboard = "/candidate";
    try {
      dashboard = await getDashboardPath(user.id);
    } catch {
      // default stands
    }
    redirect(dashboard);
  }

  const rawType = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const defaultType = rawType === "employer" ? "employer" : "candidate";
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = safeNextPath(rawNext) ?? undefined;

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1 text-slate-600">
        {defaultType === "employer"
          ? "Hire faster with applicant tracking built for Pakistani teams."
          : "Free forever for job seekers — search, save, and apply."}
      </p>

      <Card className="mt-6 p-6">
        <RegisterForm defaultType={defaultType} next={next} />
      </Card>
    </main>
  );
}
