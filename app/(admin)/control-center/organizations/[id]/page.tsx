import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminDeniedError,
  adminPageGuard,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import {
  ConfirmActionButton,
  NoteActionButton,
} from "@/app/(admin)/_components/action-buttons";
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
import { formatDateKarachi, formatDateOnlyKarachi } from "@/lib/format";
import { AddMemberDialog } from "./AddMemberDialog";
import {
  removeOrgMember,
  setMemberRole,
  setOrgAccountStatus,
  setOrgVerification,
} from "../actions";

export const metadata: Metadata = { title: "Control Center — Organization detail" };
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  org_admin: "Org admin",
  hr_manager: "HR manager",
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
  employee: "Employee",
};

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let admin;
  try {
    ({ admin } = await adminPageGuard(`/control-center/organizations/${id}`));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  const { data: org, error } = await admin
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load organization: ${error.message}`);
  if (!org) notFound();

  const [membersRes, rolesRes, jobsRes, appsRes] = await Promise.all([
    admin
      .from("organization_memberships")
      .select("user_id,title,is_active,created_at,profile:profiles(email,display_name)")
      .eq("org_id", id)
      .order("created_at", { ascending: false }),
    admin.from("user_roles").select("user_id,role").eq("org_id", id),
    admin
      .from("jobs")
      .select("id,title,status,created_at")
      .eq("org_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("applications")
      .select("id,stage,submitted_at,job:jobs(title),profile:profiles(email)")
      .eq("org_id", id)
      .order("submitted_at", { ascending: false })
      .limit(10),
  ]);

  const roleMap = new Map<string, string[]>();
  for (const r of rolesRes.data ?? []) {
    const list = roleMap.get(r.user_id as string) ?? [];
    list.push(r.role as string);
    roleMap.set(r.user_id as string, list);
  }

  const as = org.account_status as string;
  const vs = org.verification_status as string;

  return (
    <main className="space-y-6">
      <div>
        <Link href="/control-center/organizations" className="text-sm text-brand-700 hover:underline">
          ← Organizations
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{org.name as string}</h1>
            <div className="mt-2 flex gap-2">
              <Badge tone={vs === "verified" ? "success" : vs === "pending" ? "warning" : "neutral"}>
                {vs}
              </Badge>
              <Badge tone={as === "active" ? "success" : as === "suspended" ? "danger" : "neutral"}>
                {as}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/control-center/organizations/${id}/edit`}
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50"
            >
              Edit
            </Link>
            {vs !== "verified" && (
              <NoteActionButton
                title="Verify organization"
                confirmLabel="Verify"
                buttonLabel="Verify"
                payload={{ id, status: "verified" }}
                action={setOrgVerification}
              />
            )}
            {as === "active" ? (
              <NoteActionButton
                title="Suspend organization"
                description="Suspended orgs are hidden from public job listings."
                danger
                confirmLabel="Suspend"
                buttonLabel="Suspend"
                payload={{ id, status: "suspended" }}
                action={setOrgAccountStatus}
              />
            ) : (
              as === "suspended" && (
                <ConfirmActionButton
                  title="Reactivate organization"
                  message="Restore this organization to active status?"
                  confirmLabel="Reactivate"
                  buttonLabel="Reactivate"
                  payload={{ id, status: "active" }}
                  action={async (p) => setOrgAccountStatus(p, "Reactivated by super admin.")}
                />
              )
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Slug</dt><dd className="font-mono">{org.slug as string}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Industry</dt><dd>{(org.industry as string) ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Website</dt><dd>{(org.website as string) ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Contact email</dt><dd>{(org.contact_email as string) ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Contact phone</dt><dd>{(org.contact_phone as string) ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Created</dt><dd>{formatDateKarachi(org.created_at as string)}</dd></div>
            </dl>
            {org.about ? <p className="mt-3 text-sm text-slate-600">{org.about as string}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Org-level permission notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Org admins manage members, departments and org settings; they cannot touch platform settings.</li>
              <li>HR managers and recruiters run hiring (jobs, pipeline, interviews, offers) within this org.</li>
              <li>Hiring managers give interview feedback and approve offers; employees have read-only portal access.</li>
              <li>Role grants are only effective while the membership row is active; deactivating a membership disables all org roles immediately.</li>
              <li>Suspending the org (account_status = suspended) hides all its jobs from public listings; staff access to existing data is unchanged.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Members & org admins ({(membersRes.data ?? []).length})</CardTitle>
            <AddMemberDialog orgId={id} orgName={org.name as string} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>Roles</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(membersRes.data ?? []).map((m) => {
                const profile = m.profile as { email?: string; display_name?: string } | null;
                const memberId = m.user_id as string;
                const memberRoles = roleMap.get(memberId) ?? [];
                return (
                  <TableRow key={memberId}>
                    <TableCell>
                      <div className="font-medium">{profile?.display_name ?? "—"}</div>
                      <div className="text-xs text-slate-500">{profile?.email ?? memberId}</div>
                    </TableCell>
                    <TableCell>{(m.title as string) ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {memberRoles.map((r) => (
                          <Badge key={r} tone="info">{ROLE_LABELS[r] ?? r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge tone={m.is_active ? "success" : "neutral"}>
                        {m.is_active ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ROLE_LABELS).map(([value, label]) =>
                          memberRoles.includes(value) ? null : (
                            <ConfirmActionButton
                              key={value}
                              title={`Set role to ${label}`}
                              message={`Change this member's org role to ${label}? Previous org roles are replaced.`}
                              confirmLabel="Change role"
                              buttonLabel={label}
                              payload={{ orgId: id, memberUserId: memberId, role: value }}
                              action={setMemberRole}
                            />
                          ),
                        )}
                        <ConfirmActionButton
                          title="Remove member"
                          message="Deactivate this membership and remove all org role grants?"
                          confirmLabel="Remove"
                          danger
                          buttonLabel="Remove"
                          payload={{ orgId: id, memberUserId: memberId }}
                          action={removeOrgMember}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent jobs</CardTitle></CardHeader>
          <CardContent>
            {(jobsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No jobs yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(jobsRes.data ?? []).map((j) => (
                  <li key={j.id as string} className="flex items-center justify-between gap-2">
                    <Link href={`/control-center/jobs/${j.id as string}`} className="text-brand-700 hover:underline">
                      {j.title as string}
                    </Link>
                    <Badge tone="neutral">{j.status as string}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent applications</CardTitle></CardHeader>
          <CardContent>
            {(appsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No applications yet.</p>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Candidate</TableHeaderCell>
                    <TableHeaderCell>Job</TableHeaderCell>
                    <TableHeaderCell>Stage</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(appsRes.data ?? []).map((a) => {
                    const job = a.job as { title?: string } | null;
                    const profile = a.profile as { email?: string } | null;
                    return (
                      <TableRow key={a.id as string}>
                        <TableCell className="text-xs">{profile?.email ?? "—"}</TableCell>
                        <TableCell>{job?.title ?? "—"}</TableCell>
                        <TableCell><Badge tone="info">{a.stage as string}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {as === "suspended" && (
        <Alert tone="warning" title="Suspended organization">
          This organization is suspended: its jobs must not appear in public listings. Staff can
          still access existing applications and data.
        </Alert>
      )}
      <p className="text-xs text-slate-400">
        Created {formatDateOnlyKarachi(org.created_at as string)} · Updated{" "}
        {formatDateKarachi(org.updated_at as string)}
      </p>
    </main>
  );
}
