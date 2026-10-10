import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "./AdminLoginForm";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Control Center — Sign in" };

/**
 * Dedicated admin login checkpoint.
 *
 * NOTE on reachability: middleware.ts redirects unauthenticated visitors of
 * /control-center/* to the main /login first, so this page normally sees
 * either (a) a signed-in super_admin → redirect to the dashboard, or
 * (b) a signed-in non-admin → sign out + generic "unauthorized" message.
 * The email+password form below is the standalone fallback for any path that
 * reaches this page without a session.
 */
export default async function AdminLoginPage() {
  const sessionUser = await getSessionUser();

  if (sessionUser) {
    if (await isSuperAdmin(sessionUser.id)) {
      redirect("/control-center");
    }
    // Signed in but not a super admin: destroy the session and show a
    // generic unauthorized message (never which check failed).
    const supabase = await createClient();
    await supabase.auth.signOut();
    return (
      <main className="mx-auto max-w-md py-16">
        <Card>
          <CardHeader>
            <CardTitle>Control Center sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert tone="error">
              You are not authorized to access the Control Center.
            </Alert>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <AdminLoginForm />;
}
