import type { Metadata } from "next";
import { AdminDeniedError, adminPageGuard } from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
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

export const metadata: Metadata = { title: "Control Center — Roles" };
export const dynamic = "force-dynamic";

/**
 * Role matrix, documented from lib/rbac.ts.
 *
 * Rank model (higher = more privilege): employee 1 < hiring_manager 2 <
 * recruiter 3 < hr_manager 4 < org_admin 5. super_admin and candidate are
 * platform-wide (org_id NULL); org roles are scoped to one organization and
 * only effective while organization_memberships.is_active is true.
 */
const CAPABILITIES = [
  "Platform settings & control center",
  "Manage organizations (verify/suspend)",
  "Manage users & platform roles",
  "Moderate any org's jobs",
  "View cross-org applications",
  "Manage org members & org roles",
  "Post & manage org jobs",
  "Move applications through pipeline",
  "Schedule interviews, send offers",
  "Interview feedback & approvals",
  "Apply to jobs, manage own profile",
] as const;

type Cap = (typeof CAPABILITIES)[number];

const MATRIX: { role: string; scope: string; rank: string; caps: Record<Cap, boolean>; notes: string }[] = [
  {
    role: "super_admin",
    scope: "Platform-wide",
    rank: "— (above all)",
    notes: "Granted only by an existing super admin with typed confirmation. Last active super admin cannot be revoked/suspended.",
    caps: {
      "Platform settings & control center": true,
      "Manage organizations (verify/suspend)": true,
      "Manage users & platform roles": true,
      "Moderate any org's jobs": true,
      "View cross-org applications": true,
      "Manage org members & org roles": true,
      "Post & manage org jobs": true,
      "Move applications through pipeline": true,
      "Schedule interviews, send offers": true,
      "Interview feedback & approvals": true,
      "Apply to jobs, manage own profile": true,
    },
  },
  {
    role: "org_admin",
    scope: "One organization",
    rank: "5 (highest org role)",
    notes: "requireOrgRole(…, { atLeast: 'org_admin' }) gates org admin actions.",
    caps: {
      "Platform settings & control center": false,
      "Manage organizations (verify/suspend)": false,
      "Manage users & platform roles": false,
      "Moderate any org's jobs": false,
      "View cross-org applications": false,
      "Manage org members & org roles": true,
      "Post & manage org jobs": true,
      "Move applications through pipeline": true,
      "Schedule interviews, send offers": true,
      "Interview feedback & approvals": true,
      "Apply to jobs, manage own profile": false,
    },
  },
  {
    role: "hr_manager",
    scope: "One organization",
    rank: "4",
    notes: "Full hiring operations within the org; cannot manage members or org settings.",
    caps: {
      "Platform settings & control center": false,
      "Manage organizations (verify/suspend)": false,
      "Manage users & platform roles": false,
      "Moderate any org's jobs": false,
      "View cross-org applications": false,
      "Manage org members & org roles": false,
      "Post & manage org jobs": true,
      "Move applications through pipeline": true,
      "Schedule interviews, send offers": true,
      "Interview feedback & approvals": true,
      "Apply to jobs, manage own profile": false,
    },
  },
  {
    role: "recruiter",
    scope: "One organization",
    rank: "3",
    notes: "Day-to-day sourcing, screening and scheduling.",
    caps: {
      "Platform settings & control center": false,
      "Manage organizations (verify/suspend)": false,
      "Manage users & platform roles": false,
      "Moderate any org's jobs": false,
      "View cross-org applications": false,
      "Manage org members & org roles": false,
      "Post & manage org jobs": true,
      "Move applications through pipeline": true,
      "Schedule interviews, send offers": true,
      "Interview feedback & approvals": false,
      "Apply to jobs, manage own profile": false,
    },
  },
  {
    role: "hiring_manager",
    scope: "One organization",
    rank: "2",
    notes: "Reviews candidates, gives feedback, approves offers for their requisitions.",
    caps: {
      "Platform settings & control center": false,
      "Manage organizations (verify/suspend)": false,
      "Manage users & platform roles": false,
      "Moderate any org's jobs": false,
      "View cross-org applications": false,
      "Manage org members & org roles": false,
      "Post & manage org jobs": false,
      "Move applications through pipeline": false,
      "Schedule interviews, send offers": false,
      "Interview feedback & approvals": true,
      "Apply to jobs, manage own profile": false,
    },
  },
  {
    role: "employee",
    scope: "One organization",
    rank: "1 (lowest org role)",
    notes: "Read-only internal portal access (employee_portal_enabled setting).",
    caps: {
      "Platform settings & control center": false,
      "Manage organizations (verify/suspend)": false,
      "Manage users & platform roles": false,
      "Moderate any org's jobs": false,
      "View cross-org applications": false,
      "Manage org members & org roles": false,
      "Post & manage org jobs": false,
      "Move applications through pipeline": false,
      "Schedule interviews, send offers": false,
      "Interview feedback & approvals": false,
      "Apply to jobs, manage own profile": false,
    },
  },
  {
    role: "candidate",
    scope: "Platform-wide (job seeker)",
    rank: "— (outside org rank)",
    notes: "Can apply to published jobs from active orgs; PII private by default (is_searchable=false).",
    caps: {
      "Platform settings & control center": false,
      "Manage organizations (verify/suspend)": false,
      "Manage users & platform roles": false,
      "Moderate any org's jobs": false,
      "View cross-org applications": false,
      "Manage org members & org roles": false,
      "Post & manage org jobs": false,
      "Move applications through pipeline": false,
      "Schedule interviews, send offers": false,
      "Interview feedback & approvals": false,
      "Apply to jobs, manage own profile": true,
    },
  },
];

export default async function RolesPage() {
  try {
    await adminPageGuard("/control-center/roles");
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Role matrix</h1>
        <p className="mt-1 text-sm text-slate-600">
          The 7 platform roles and their capabilities, documented from the rank model in
          lib/rbac.ts. Authorization is always re-verified against user_roles on each request.
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Capability</TableHeaderCell>
                {MATRIX.map((m) => (
                  <TableHeaderCell key={m.role}>
                    <div className="font-semibold normal-case tracking-normal">{m.role}</div>
                    <div className="mt-0.5 font-normal normal-case tracking-normal text-slate-400">
                      {m.scope}
                    </div>
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {CAPABILITIES.map((cap) => (
                <TableRow key={cap}>
                  <TableCell className="font-medium">{cap}</TableCell>
                  {MATRIX.map((m) => (
                    <TableCell key={m.role} className="text-center">
                      {m.caps[cap] ? (
                        <span aria-label="allowed" className="text-emerald-600 font-bold">✓</span>
                      ) : (
                        <span aria-label="not allowed" className="text-slate-300">—</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Rank / notes</TableCell>
                {MATRIX.map((m) => (
                  <TableCell key={m.role} className="min-w-44 text-xs text-slate-500">
                    <Badge tone="neutral" className="mb-1">{m.rank}</Badge>
                    <p>{m.notes}</p>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Assignment rules</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>
              <strong>Who can grant what:</strong> only super admins (via this Control Center) can
              grant or revoke platform roles. Org admins manage memberships within their own
              organization.
            </li>
            <li>
              <strong>super_admin grants</strong> require the granter to type{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-xs">GRANT SUPER ADMIN</code>.
              Grants are platform-wide (org_id NULL).
            </li>
            <li>
              <strong>Last active super admin</strong> can never be revoked or suspended — the
              action is refused with an error.
            </li>
            <li>
              <strong>Org roles</strong> require an active <code className="font-mono text-xs">organization_memberships</code> row;
              grants are inert without one.
            </li>
            <li>
              <strong>Candidate PII</strong> additionally requires <code className="font-mono text-xs">can_view_candidate()</code>
              semantics in RLS; service-role code must still authorize via lib/rbac.ts first.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Alert tone="info">
        Every grant and revocation performed here is written to audit_logs (actions
        role.granted / role.revoked) and visible under Audit Logs and the user&apos;s detail page.
      </Alert>
    </main>
  );
}
