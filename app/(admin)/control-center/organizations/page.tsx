import type { Metadata } from "next";
import {
  AdminDeniedError,
  adminPageGuard,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";

export const metadata: Metadata = { title: "Control Center — Organizations" };
export const dynamic = "force-dynamic";

/** Minimal test version to isolate the crash. */
export default async function OrganizationsPage() {
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/organizations"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  const { data, error } = await admin
    .from("organizations")
    .select("id,name,slug")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw new Error(`Failed: ${error.message}`);

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-2xl font-bold">Organizations</h1>
      <p className="mt-1 text-sm text-slate-600">
        {(data ?? []).length} organizations shown. Full management UI is being restored.
      </p>
      <ul>
        {(data ?? []).map((o: any) => (
          <li key={o.id}>{o.name} ({o.slug})</li>
        ))}
      </ul>
    </main>
  );
}
