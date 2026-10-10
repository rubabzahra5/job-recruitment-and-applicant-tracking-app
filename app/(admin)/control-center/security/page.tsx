import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AdminDeniedError,
  adminPageGuard,
  firstParam,
  getPagination,
  parseDateRange,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { FilterBar, PaginationNav } from "@/app/(admin)/_components/filters";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { formatDateKarachi, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Control Center — Security" };
export const dynamic = "force-dynamic";

/** Action patterns considered security-relevant. */
const SECURITY_PATTERNS = [
  "action.ilike.auth.%",
  "action.ilike.user.suspend%",
  "action.ilike.user.reactivat%",
  "action.ilike.user.provisioned",
  "action.ilike.role.%",
  "action.ilike.organization.account_%",
  "action.ilike.candidate_pii_revealed",
  "action.ilike.invitation.%",
  "action.ilike.platform_settings.%",
  "action.ilike.privacy_request.%",
].join(",");

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/security"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params, 20);
  const range = parseDateRange(params);
  const actionFilter = (firstParam(params.action) ?? "").trim();

  let eventsQuery = admin
    .from("audit_logs")
    .select(
      "id,action,entity_type,created_at,metadata,actor:profiles!audit_logs_actor_user_id_fkey(email)",
      { count: "exact" },
    )
    .or(SECURITY_PATTERNS)
    .order("created_at", { ascending: false });
  if (range.from) eventsQuery = eventsQuery.gte("created_at", range.from);
  if (range.to) eventsQuery = eventsQuery.lt("created_at", range.to);
  if (actionFilter) eventsQuery = eventsQuery.ilike("action", `%${actionFilter}%`);
  const eventsRes = await eventsQuery.range(from, to);
  if (eventsRes.error) throw new Error(`Failed to load security events: ${eventsRes.error.message}`);
  const events = eventsRes.data ?? [];
  const totalPages = Math.max(1, Math.ceil((eventsRes.count ?? 0) / perPage));

  const suspendedRes = await admin
    .from("profiles")
    .select("id,email,display_name,updated_at")
    .eq("is_active", false)
    .order("updated_at", { ascending: false })
    .limit(50);
  const suspendedIds = (suspendedRes.data ?? []).map((p) => p.id as string);
  const rolesRes =
    suspendedIds.length > 0
      ? await admin.from("user_roles").select("user_id,role").in("user_id", suspendedIds)
      : { data: [] as never[] };
  const roleMap = new Map<string, string[]>();
  for (const r of (rolesRes.data ?? []) as Array<{ user_id: string; role: string }>) {
    const list = roleMap.get(r.user_id) ?? [];
    list.push(r.role);
    roleMap.set(r.user_id, list);
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="mt-1 text-sm text-slate-600">
          Security-relevant audit events, suspended accounts, and session/revocation guidance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Session & revocation</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>
                Suspending an account (profiles.is_active=false) blocks new sign-ins: the user
                cannot obtain a fresh session. This is enforced at the application sign-in layer.
              </li>
              <li>
                Existing sessions: Supabase does not expose a “revoke all sessions” admin API
                call from this codebase. To force sign-out everywhere, use the Supabase dashboard
                → Authentication → select the user → sign out, or delete the user.
              </li>
              <li>
                Password resets issued from the Users page generate real Supabase recovery links;
                delivering the link to the user invalidates nothing else — rotate credentials if
                compromise is suspected.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rate limits & login signals</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>
                Supabase Auth rate-limits sign-in attempts per project (see Supabase dashboard →
                Authentication → Rate limits). Repeated failures return HTTP 429 from the Auth API.
              </li>
              <li>
                <strong>Failed-login signal:</strong> Supabase Auth logs are not exposed through
                the database or the JS admin API used here. Check the Supabase dashboard →
                Authentication → Logs for failed sign-in attempts. Admin sign-ins to this Control
                Center are recorded as <code className="font-mono text-xs">auth.admin_login</code> in
                audit_logs and appear below.
              </li>
              <li>
                Keep the service-role key server-side only (lib/supabase/admin.ts is server-only
                by construction); never embed it in client components.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suspended accounts ({(suspendedRes.data ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {(suspendedRes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No suspended accounts.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Account</TableHeaderCell>
                  <TableHeaderCell>Roles</TableHeaderCell>
                  <TableHeaderCell>Suspended</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(suspendedRes.data ?? []).map((p) => (
                  <TableRow key={p.id as string}>
                    <TableCell>
                      <a href={`/control-center/users/${p.id as string}`} className="font-medium text-brand-700 hover:underline">
                        {(p.email as string) ?? "—"}
                      </a>
                      <div className="text-xs text-slate-500">{(p.display_name as string) ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(roleMap.get(p.id as string) ?? []).map((r) => (
                          <Badge key={r} tone={r === "super_admin" ? "danger" : "neutral"}>{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500" title={formatDateKarachi(p.updated_at as string)}>
                      {timeAgo(p.updated_at as string)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Security events</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4">
            <Suspense>
              <FilterBar
                fields={[
                  { key: "action", label: "Action contains", type: "search", placeholder: "role.granted" },
                  { key: "from", label: "From", type: "date" },
                  { key: "to", label: "To", type: "date" },
                ]}
              />
            </Suspense>
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>When (PKT)</TableHeaderCell>
                <TableHeaderCell>Actor</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>Entity</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((e) => {
                const actor = e.actor as { email?: string } | null;
                return (
                  <TableRow key={e.id as string}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateKarachi(e.created_at as string)}
                    </TableCell>
                    <TableCell className="max-w-44 truncate text-xs">{actor?.email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.action as string}</TableCell>
                    <TableCell className="text-xs text-slate-500">{e.entity_type as string}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Suspense>
            <PaginationNav page={page} totalPages={totalPages} />
          </Suspense>
        </CardContent>
      </Card>

      <Alert tone="warning" title="Known gap — document, not enforce">
        Suspended users are blocked at sign-in (profiles.is_active=false), but lib/auth.ts
        requireSessionUser() does not currently re-check is_active on every request, and
        middleware does not check it either. Enforcement hardening belongs to the foundation
        owner; this page documents the current state honestly.
      </Alert>
    </main>
  );
}
