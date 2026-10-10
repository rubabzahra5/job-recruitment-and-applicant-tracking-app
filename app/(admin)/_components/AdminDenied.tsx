import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

/**
 * Rendered when a signed-in user without the super_admin grant reaches a
 * control-center page. Deliberately generic: it does not reveal which check
 * failed, and it exposes nothing about org internals.
 */
export function AdminDenied() {
  return (
    <main className="mx-auto max-w-xl py-16">
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert tone="error">
            You are not authorized to access the Control Center. If you believe
            this is a mistake, contact your platform administrator.
          </Alert>
        </CardContent>
      </Card>
    </main>
  );
}
