import type { Metadata } from "next";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  ExportButton,
  DeletionForm,
  CorrectionForm,
  PrivacyNotice,
  RequestHistory,
} from "./_components/PrivacyTools";
import { listPrivacyRequests } from "./_actions";

export const metadata: Metadata = { title: "Privacy & Data" };

export default async function PrivacyPage() {
  await requireCandidate();
  const requests = await listPrivacyRequests();

  return (
    <main>
      <h1 className="text-2xl font-bold tracking-tight">Privacy & data</h1>
      <p className="mt-1 text-sm text-slate-600">
        How your data is used, and your rights over it.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Privacy notice</CardTitle>
          </CardHeader>
          <CardContent>
            <PrivacyNotice />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export my data</CardTitle>
          </CardHeader>
          <CardContent>
            <ExportButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Correct my data</CardTitle>
          </CardHeader>
          <CardContent>
            <CorrectionForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delete my data</CardTitle>
          </CardHeader>
          <CardContent>
            <DeletionForm />
            <RequestHistory requests={requests} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
