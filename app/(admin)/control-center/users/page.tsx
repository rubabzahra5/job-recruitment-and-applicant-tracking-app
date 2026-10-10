import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AdminDeniedError,
  adminPageGuard,
  firstParam,
  getPagination,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { ConfirmActionButton } from "@/app/(admin)/_components/action-buttons";
import { FilterBar, PaginationNav } from "@/app/(admin)/_components/filters";
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
import { formatDateKarachi } from "@/lib/format";
import { InviteDialog, ProvisionDialog } from "./UserDialogs";
import { ResendInvitationButton } from "./ResendButton";
import { revokeInvitation } from "./actions";

export const metadata: Metadata = { title: "Control Center — Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/users"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params);
  const search = (firstParam(params.q) ?? "").trim();
  const roleFilter = firstParam(params.role) ?? "";
  const activeFilter = firstParam(params.active) ?? "";

  // Base profile query with filters.
  let query = admin
    .from("profiles")
    .select("id,email,display_name,is_active,created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (search) query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
  if (activeFilter === "active") query = query.eq("is_active", true);
  if (activeFilter === "suspended") query = query.eq("is_active", false);

  let profileIds: string[] | null = null;
  if (roleFilter) {
    const { data: grants } = await admin.from("user_roles").select("user_id").eq("role", roleFilter);
    profileIds = [...new Set((grants ?? []).map((g) => g.user_id as string))];
    if (profileIds.length === 0) {
      profileIds = ["00000000-0000-0000-0000-000000000000"]; // match nothing
    }
    query = query.in("id", profileIds);
  }
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(`Failed to load users: ${error.message}`);
  const profiles = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  const visibleIds = profiles.map((p) => p.id as string);
  const [rolesRes, orgsRes, invitationsRes] = await Promise.all([
    visibleIds.length > 0
      ? admin.from("user_roles").select("user_id,role,org:organizations(name)").in("user_id", visibleIds)
      : Promise.resolve({ data: [] as never[] }),
    admin.from("organizations").select("id,name").order("name").limit(200),
    admin
      .from("organization_invitations")
      .select("id,email,role,expires_at,status,created_at,org:organizations(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const roleMap = new Map<string, Array<{ role: string; org: string | null }>>();
  for (const r of (rolesRes.data ?? []) as Array<{ user_id: string; role: string; org: { name?: string } | null }>) {
    const list = roleMap.get(r.user_id) ?? [];
    list.push({ role: r.role, org: r.org?.name ?? null });
    roleMap.set(r.user_id, list);
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            {count ?? 0} accounts. Suspension sets is_active=false; suspended users are
            blocked from signing in (see Security notes).
          </p>
        </div>
        <div className="flex gap-2">
          <InviteDialog orgs={(orgsRes.data ?? []).map((o) => ({ id: o.id as string, name: o.name as string }))} />
          <ProvisionDialog />
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Suspense>
            <FilterBar
              fields={[
                { key: "q", label: "Search email/name", type: "search", placeholder: "user@example.com" },
                {
                  key: "role",
                  label: "Role",
                  type: "select",
                  options: ["super_admin", "org_admin", "hr_manager", "recruiter", "hiring_manager", "employee", "candidate"].map((v) => ({ value: v, label: v })),
                },
                {
                  key: "active",
                  label: "Status",
                  type: "select",
                  options: [
                    { value: "active", label: "Active" },
                    { value: "suspended", label: "Suspended" },
                  ],
                },
              ]}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Roles</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {profiles.map((p) => {
                const id = p.id as string;
                const grants = roleMap.get(id) ?? [];
                return (
                  <TableRow key={id}>
                    <TableCell>
                      <Link href={`/control-center/users/${id}`} className="font-medium text-brand-700 hover:underline">
                        {(p.email as string) ?? "—"}
                      </Link>
                      <div className="text-xs text-slate-500">{(p.display_name as string) ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {grants.length === 0 && <span className="text-xs text-slate-400">no roles</span>}
                        {grants.map((g, i) => (
                          <Badge key={i} tone={g.role === "super_admin" ? "danger" : "info"}>
                            {g.role}{g.org ? ` · ${g.org}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge tone={p.is_active ? "success" : "danger"}>
                        {p.is_active ? "active" : "suspended"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDateKarachi(p.created_at as string)}
                    </TableCell>
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

      <Card>
        <CardHeader><CardTitle>Pending invitations</CardTitle></CardHeader>
        <CardContent>
          {(invitationsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No pending invitations.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Organization</TableHeaderCell>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Expires</TableHeaderCell>
                  <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(invitationsRes.data ?? []).map((inv) => {
                  const org = inv.org as { name?: string } | null;
                  return (
                    <TableRow key={inv.id as string}>
                      <TableCell>{inv.email as string}</TableCell>
                      <TableCell>{org?.name ?? "—"}</TableCell>
                      <TableCell><Badge tone="info">{inv.role as string}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDateKarachi(inv.expires_at as string)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <ResendInvitationButton
                            invitationId={inv.id as string}
                            email={inv.email as string}
                          />
                          <ConfirmActionButton
                            title="Revoke invitation"
                            message={`Revoke the pending invitation for ${inv.email as string}?`}
                            confirmLabel="Revoke"
                            danger
                            buttonLabel="Revoke"
                            payload={{ invitationId: inv.id as string }}
                            action={revokeInvitation}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Resending regenerates the token and shows it for manual delivery; no email is sent automatically.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
