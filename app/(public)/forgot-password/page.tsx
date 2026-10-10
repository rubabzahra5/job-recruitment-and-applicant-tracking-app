import type { Metadata } from "next";

import { Card } from "@/components/ui/Card";
import { ForgotPasswordForm } from "../_components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your HirePakistan password.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Forgot your password?</h1>
      <p className="mt-1 text-slate-600">
        Enter your account email and we&apos;ll send you a reset link.
      </p>
      <Card className="mt-6 p-6">
        <ForgotPasswordForm />
      </Card>
    </main>
  );
}
