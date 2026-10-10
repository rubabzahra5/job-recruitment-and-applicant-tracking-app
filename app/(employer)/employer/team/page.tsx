import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatDateOnlyKarachi } from "@/lib/format";
import { getOrgContext, NoOrganizationError } from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { InviteForm } from "../../_components/InviteForm";
import { MemberActions, InvitationActions } from "../../_components/TeamActions";
import {
  getTeamPageData,
  inviteMember,
  resendInvitation,
  revokeInvitation,
  changeMemberRole,
  removeMember,
} from "./actions";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  const canInvite = ["org_admin", "hr_manager"].includes(ctx.role);
  const canManageRoles = ctx.role === "org_admin";
  const data = await getTeamPageData(ctx.orgId);

  const pendingInvites = data.invitations.filter((i) => i.status === "pending");
  const otherInvites = data.invitations.filter((i) => i.status !== "pending");

  return (
    <main>
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="mt-1 text-sm text-slate-500">
        {data.members.filter((m) => m.isActive).length} active member{data.members.filter((m) => m.isActive).length === 1 ? "" : "s"} · {ctx.org.name}
      </p>

      {canInvite && (
        <div className="mt-4">
          <InviteForm
            departments={data.departments}
            invitableRoles={data.invitableRoles}
            inviteAction={inviteMember.bind(null, ctx.orgId)}
          />
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Department</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {canManageRoles && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium">
                    {m.displayName ?? "—"}
                    {m.userId === ctx.user.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  </TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <Badge tone={m.role === "org_admin" ? "info" : "neutral"}>{m.role?.replace("_", " ") ?? "—"}</Badge>
                  </TableCell>
                  <TableCell>{m.departmentName ?? "—"}{m.title ? ` · ${m.title}` : ""}</TableCell>
                  <TableCell>
                    <Badge tone={m.isActive ? "success" : "neutral"}>{m.isActive ? "active" : "inactive"}</Badge>
                  </TableCell>
                  {canManageRoles && (
                    <TableCell>
                      {m.isActive ? (
                        <MemberActions
                          userId={m.userId}
                          currentRole={m.role}
                          isSelf={m.userId === ctx.user.id}
                          invitableRoles={data.invitableRoles}
                          changeRoleAction={changeMemberRole.bind(null, ctx.orgId)}
                          removeAction={removeMember.bind(null, ctx.orgId)}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Inactive</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canInvite && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Invitations ({pendingInvites.length} pending)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.invitations.length === 0 ? (
              <EmptyState title="No invitations" description="Invited team members will appear here." />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Email</TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Department</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Expires</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingInvites.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.email}</TableCell>
                      <TableCell>{i.role.replace("_", " ")}</TableCell>
                      <TableCell>{i.departmentName ?? "—"}</TableCell>
                      <TableCell><Badge tone="warning">{i.status}</Badge></TableCell>
                      <TableCell>{formatDateOnlyKarachi(i.expiresAt)}</TableCell>
                      <TableCell>
                        <InvitationActions
                          invitationId={i.id}
                          resendAction={resendInvitation.bind(null, ctx.orgId)}
                          revokeAction={revokeInvitation.bind(null, ctx.orgId)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {otherInvites.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.email}</TableCell>
                      <TableCell>{i.role.replace("_", " ")}</TableCell>
                      <TableCell>{i.departmentName ?? "—"}</TableCell>
                      <TableCell><Badge tone="neutral">{i.status}</Badge></TableCell>
                      <TableCell>{formatDateOnlyKarachi(i.expiresAt)}</TableCell>
                      <TableCell><span className="text-xs text-slate-400">—</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
