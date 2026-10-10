import type { Metadata } from "next";
import { AdminDeniedError, adminPageGuard } from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { Alert } from "@/components/ui/Alert";
import { loadSettings } from "./actions";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Control Center — Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  try {
    await adminPageGuard("/control-center/settings");
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const initial = await loadSettings();

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Persisted to platform_settings (key → JSON value). Every save is audit-logged with
          the changed keys.
        </p>
      </div>
      <Alert tone="info">
        Verification status (checked 2026-10-10): no route code reads platform_settings yet —
        the “Consumed by” notes under each setting are the contract for the agents building the
        employer, candidate and public code paths. See MODULE_SUMMARY_D.md for details.
      </Alert>
      <SettingsForm initial={initial} />
    </main>
  );
}
