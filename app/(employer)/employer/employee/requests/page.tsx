import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateKarachi } from "@/lib/format";
import { getOrgContext, NoOrganizationError } from "../../../_lib/org";
import { NoOrgState } from "../../../_components/NoOrgState";
import { EmployeeSubNav } from "../../../_components/EmployeeSubNav";
import { HrRequestForm } from "../../../_components/EmployeeForms";
import { getHrRequests, requireEmployeePortal, sendHrRequest } from "../actions";

export const metadata: Metadata = { title: "HR requests" };

export default async function EmployeeRequestsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  await requireEmployeePortal(ctx.orgId);
  const requests = await getHrRequests(ctx.orgId);

  return (
    <main>
      <h1 className="text-2xl font-bold">HR requests</h1>
      <p className="mt-1 text-sm text-slate-500">Send a request to your HR team — they are notified in-app.</p>
      <div className="mt-4">
        <EmployeeSubNav orgId={ctx.orgId} current="/requests" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>New request</CardTitle>
        </CardHeader>
        <CardContent>
          <HrRequestForm sendAction={sendHrRequest.bind(null, ctx.orgId)} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Your requests ({requests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState title="No requests yet" description="Requests you send will be listed here." />
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{r.title.replace(/^HR request sent: /, "")}</span>
                    <span>{formatDateKarachi(r.createdAt)}</span>
                  </div>
                  {r.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{r.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
