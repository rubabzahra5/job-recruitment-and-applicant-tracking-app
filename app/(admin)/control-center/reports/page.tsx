import type { Metadata } from "next";
import { AdminDeniedError, adminPageGuard } from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { ReportsClient } from "./ReportsClient";

export const metadata: Metadata = { title: "Control Center — Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  try {
    await adminPageGuard("/control-center/reports");
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports — CSV exports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bounded, scoped exports (RFC 4180, formula-injection safe). Every download is audited.
        </p>
      </div>
      <ReportsClient />
    </main>
  );
}
