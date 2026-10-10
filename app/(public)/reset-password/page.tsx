import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { ResetPasswordForm } from "../_components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Choose a new password for your HirePakistan account.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const code = Array.isArray(sp.code) ? sp.code[0] : sp.code;

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Choose a new password</h1>
      <Card className="mt-6 p-6">
        {code ? (
          <ResetPasswordForm code={code} />
        ) : (
          <div className="space-y-4">
            <Alert tone="error" title="Invalid reset link">
              This password-reset link is missing or malformed. Reset links are
              single-use and expire quickly.
            </Alert>
            <Link
              href="/forgot-password"
              className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              Request a new reset link
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
