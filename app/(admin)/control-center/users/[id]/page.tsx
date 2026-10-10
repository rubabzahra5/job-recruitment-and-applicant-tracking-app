import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminDeniedError,
  adminPageGuard,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { ConfirmActionButton } from "@/app/(admin)/_components/action-buttons";
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
import { AssignRoleDialog, PasswordResetButton } from "./UserDetailDialogs";
import { reactivateUser, revokeRole, suspendUser } from "../actions";

export const metadata: Metadata = { title: "Control Center — User detail" };
export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let admin;
  let currentUserId: string;
  try {
    const ctx = await adminPageGuard(`/control-center/users/${id}`);
    admin = ctx.admin;
    currentUserId = ctx.user.id;
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load user: ${error.message}`);
  if (!profile) notFound();

  const [rolesRes, membershipsRes, invitationsRes, auditRes, orgsRes] = await Promise.all([
    admin.from("user_roles").select("id,role,org_id,created_at,org:organizations(name)").eq("user_id", id),
    admin
      .from("organization_memberships")
      .select("org_id,title,is_active,created_at,org:organizations(name)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("organization_invitations")
      .select("id,email,role,status,expires_at,created_at,org:organizations(name)")
      .ilike("email", (profile.email as string) ?? "")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("audit_logs")
      .select("id,action,entity_type,created_at,metadata")
      .eq("actor_user_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("organizations").select("id,name").order("name").limit(200),
  ]);

  const isActive = profile.is_active as boolean;

  return (
    <main className="space-y-6">
      <div>
        <Link href="/control-center/users" className="text-sm text-brand-700 hover:underline">
          ← Users
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{(profile.display_name as string) ?? "User"}</h1>
            <p className="mt-1 text-sm text-slate-600">{profile.email as string}</p>
            <div className="mt-2">
              <Badge tone={isActive ? "success" : "danger"}>{isActive ? "active" : "suspended"}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AssignRoleDialog
              targetUserId={id}
              orgs={(orgsRes.data ?? []).map((o) => ({ id: o.id as string, name: o.name as string }))}
            />
            <PasswordResetButton targetUserId={id} />
            {isActive ? (
              <ConfirmActionButton
                title="Suspend user"
                message={`Suspend ${(profile.email as string) ?? "this user"}? They will be blocked from signing in (profiles.is_active=false).`}
                confirmLabel="Suspend"
                danger
                buttonLabel="Suspend"
                payload={{ targetUserId: id }}
                action={suspendUser}
              />
            ) : (
              <ConfirmActionButton
                title="Reactivate user"
                message="Restore this account to active status?"
                confirmLabel="Reactivate"
                buttonLabel="Reactivate"
                payload={{ targetUserId: id }}
                action={reactivateUser}
              />
            )}
          </div>
        </div>
      </div>

      {!isActive && (
        <Alert tone="warning" title="Suspended account">
          This account is suspended (is_active=false). Suspension is enforced at sign-in: the user
          cannot obtain a new session. Existing sessions should be revoked via the Supabase
          dashboard (see Security).
        </Alert>
      )}
      {id === currentUserId && (
        <Alert tone="info">
          This is your own administrator account. Self-suspension is blocked; revoking your own
          super_admin grant is allowed only if another active super admin exists.
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle>Role grants</CardTitle></CardHeader>
        <CardContent>
          {(rolesRes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No role grants.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Scope</TableHeaderCell>
                  <TableHeaderCell>Granted</TableHeaderCell>
                  <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(rolesRes.data ?? []).map((r) => {
                  const org = r.org as { name?: string } | null;
                  const role = r.role as string;
                  return (
                    <TableRow key={r.id as string}>
                      <TableCell>
                        <Badge tone={role === "super_admin" ? "danger" : "info"}>{role}</Badge>
                      </TableCell>
                      <TableCell>{org?.name ?? (r.org_id ? (r.org_id as string) : "platform-wide")}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDateKarachi(r.created_at as string)}
                      </TableCell>
                      <TableCell>
                        <ConfirmActionButton
                          title="Revoke role"
                          message={`Revoke the ${role} grant?${role === "super_admin" ? " The last active super admin cannot be revoked." : ""}`}
                          confirmLabel="Revoke"
                          danger
                          buttonLabel="Revoke"
                          payload={{ grantId: r.id as string, targetUserId: id }}
                          action={revokeRole}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Role matrix rules: only a super admin can grant super_admin (typed confirmation
            required); the final active super admin can never be revoked or suspended; org roles
            require an active membership in the scoped organization.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Organization memberships</CardTitle></CardHeader>
          <CardContent>
            {(membershipsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No memberships.</p>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Organization</TableHeaderCell>
                    <TableHeaderCell>Title</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(membershipsRes.data ?? []).map((m, i) => {
                    const org = m.org as { name?: string } | null;
                    return (
                      <TableRow key={i}>
                        <TableCell>{org?.name ?? (m.org_id as string)}</TableCell>
                        <TableCell>{(m.title as string) ?? "—"}</TableCell>
                        <TableCell>
                          <Badge tone={m.is_active ? "success" : "neutral"}>
                            {m.is_active ? "active" : "inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Invitations</CardTitle></CardHeader>
          <CardContent>
            {(invitationsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No invitations for this email.</p>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Organization</TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Expires</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(invitationsRes.data ?? []).map((inv) => {
                    const org = inv.org as { name?: string } | null;
                    return (
                      <TableRow key={inv.id as string}>
                        <TableCell>{org?.name ?? "—"}</TableCell>
                        <TableCell><Badge tone="info">{inv.role as string}</Badge></TableCell>
                        <TableCell>{inv.status as string}</TableCell>
                        <TableCell className="whitespace-nowrap text-slate-500">
                          {formatDateKarachi(inv.expires_at as string)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Audit trail — actions by this user</CardTitle></CardHeader>
        <CardContent>
          {(auditRes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No recorded actions.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Action</TableHeaderCell>
                  <TableHeaderCell>Entity</TableHeaderCell>
                  <TableHeaderCell>When</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(auditRes.data ?? []).map((a) => (
                  <TableRow key={a.id as string}>
                    <TableCell className="font-mono text-xs">{a.action as string}</TableCell>
                    <TableCell className="text-slate-500">{a.entity_type as string}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500" title={formatDateKarachi(a.created_at as string)}>
                      {timeAgo(a.created_at as string)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        Account created {formatDateKarachi(profile.created_at as string)}
      </p>
    </main>
  );
}
