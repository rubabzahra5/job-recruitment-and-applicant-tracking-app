import type { Metadata } from "next";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  DisplayNameForm,
  EmailForm,
  PasswordForm,
  SessionCard,
} from "./_components/SettingsForms";
import { getAccountInfo } from "./_actions";

export const metadata: Metadata = { title: "Account Settings" };

export default async function SettingsPage() {
  await requireCandidate();
  const info = await getAccountInfo();

  return (
    <main>
      <h1 className="text-2xl font-bold tracking-tight">Account settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        Manage your sign-in details and account identity.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Display name</CardTitle>
          </CardHeader>
          <CardContent>
            <DisplayNameForm initial={info.displayName ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email address</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailForm currentEmail={info.email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        <SessionCard info={info} />
      </div>
    </main>
  );
}
