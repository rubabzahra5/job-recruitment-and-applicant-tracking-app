import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Control Center" };

export default async function ControlCenterPage() {
  const user = await getSessionUser();

  return (
    <main>
      <h1 className="text-2xl font-bold">Control center</h1>
      <p className="mt-2 text-slate-600">
        {user ? (
          <>
            Signed in as <span className="font-medium">{user.email}</span>.
            Platform moderation, settings and audit tools will live here.
          </>
        ) : (
          "Restricted area. Sign in with an administrator account."
        )}
      </p>
    </main>
  );
}
