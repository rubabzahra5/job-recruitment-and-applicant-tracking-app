import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AdminDeniedError,
  adminPageGuard,
  applyDateRange,
  asRows,
  firstParam,
  parseDateRange,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { FilterBar } from "@/app/(admin)/_components/filters";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { getEnv, isEmailConfigured } from "@/lib/env";
import { formatDateKarachi, timeAgo } from "@/lib/format";
import { getAuditAlerts } from "@/lib/audit-alerts";

export const metadata: Metadata = { title: "Control Center — Overview" };
export const dynamic = "force-dynamic";

const EXPECTED_BUCKETS = ["cvs", "offer-docs", "avatars", "org-logos"];

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  let admin: Awaited<ReturnType<typeof adminPageGuard>>["admin"];
  try {
    ({ admin } = await adminPageGuard("/control-center"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const range = parseDateRange(params);
  const hasRange = Boolean(range.from || range.to);

  const [
    orgsRes,
    profilesRes,
    rolesRes,
    candidatesRes,
    jobsRes,
    appsRes,
    interviewsRes,
    offersRes,
    hiresRes,
    recentProfilesRes,
    recentAuditRes,
    deliveriesRes,
    stagesRes,
    settingsRes,
    bucketsRes,
  ] = await Promise.all([
    admin.from("organizations").select("id,verification_status,account_status,created_at"),
    applyDateRange(admin.from("profiles").select("id,is_active,created_at"), range),
    admin.from("user_roles").select("user_id,role,org_id"),
    applyDateRange(admin.from("candidate_profiles").select("id"), range, "created_at"),
    applyDateRange(admin.from("jobs").select("id,status"), range),
    applyDateRange(admin.from("applications").select("id,stage"), range),
    admin.from("interviews").select("id,status,scheduled_at").gte("scheduled_at", new Date().toISOString()),
    admin.from("offers").select("id,status"),
    admin.from("hiring_records").select("id"),
    applyDateRange(
      admin.from("profiles").select("id,email,display_name,created_at").order("created_at", { ascending: false }).limit(8),
      range,
    ),
    admin.from("audit_logs").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(12),
    admin
      .from("notification_delivery_logs")
      .select("id,channel,status,attempted_at,provider_response,notification:notifications(title)")
      .in("status", ["failed", "queued"])
      .order("attempted_at", { ascending: false })
      .limit(10),
    admin.from("pipeline_stages").select("key,label").order("sort_order"),
    admin.from("platform_settings").select("key,value"),
    admin.storage.listBuckets(),
  ]);

  const orgs = asRows<{ verification_status: string; account_status: string }>(orgsRes.data);
  const profiles = asRows<{ is_active: boolean; created_at: string }>(profilesRes.data);
  const roles = asRows<{ user_id: string; role: string; org_id: string | null }>(rolesRes.data);
  const jobs = asRows<{ status: string }>(jobsRes.data);
  const apps = asRows<{ stage: string }>(appsRes.data);
  const interviews = asRows<{ status: string }>(interviewsRes.data);
  const offers = asRows<{ status: string }>(offersRes.data);

  const internalUserIds = new Set(
    roles.filter((r) => r.org_id !== null).map((r) => r.user_id as string),
  );
  const stageCounts = new Map<string, number>();
  for (const a of apps) {
    const s = a.stage as string;
    stageCounts.set(s, (stageCounts.get(s) ?? 0) + 1);
  }
  const stageLabels = new Map(
    asRows<{ key: string; label: string }>(stagesRes.data).map((s) => [s.key, s.label] as const),
  );
  const settings = new Map(
    asRows<{ key: string; value: unknown }>(settingsRes.data).map((s) => [s.key, s.value] as const),
  );
  const operatingMode = settings.get("operating_mode") ?? "—";

  // L4: Audit anomaly alerts (suspicious patterns in the last 24h).
  const auditAlerts = await getAuditAlerts(24).catch(() => []);

  // System config checklist (honest: each item reports what it actually found).
  let envStatus: "ok" | "missing";
  let emailStatus: "configured" | "unconfigured";
  try {
    getEnv();
    envStatus = "ok";
  } catch {
    envStatus = "missing";
  }
  try {
    emailStatus = isEmailConfigured() ? "configured" : "unconfigured";
  } catch {
    emailStatus = "unconfigured";
  }
  const bucketNames = new Set((bucketsRes.data ?? []).map((b) => b.name));
  const missingBuckets = EXPECTED_BUCKETS.filter((b) => !bucketNames.has(b));

  const fromParam = firstParam(params.from) ?? "";
  const toParam = firstParam(params.to) ?? "";
  const exportHref =
    `/control-center/export?kind=summary` +
    (fromParam ? `&from=${encodeURIComponent(fromParam)}` : "") +
    (toParam ? `&to=${encodeURIComponent(toParam)}` : "");

  return (
    <main className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Platform overview</h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time metrics from the production database. All times shown in Asia/Karachi.
          </p>
        </div>
        <a
          href={exportHref}
          download
          className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
        >
          Export summary CSV
        </a>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Suspense>
            <FilterBar
              fields={[
                { key: "from", label: "From", type: "date" },
                { key: "to", label: "To", type: "date" },
              ]}
              submitLabel="Apply date range"
            />
          </Suspense>
          {hasRange && (
            <p className="mt-2 text-xs text-slate-500">
              Date range applied to organizations, accounts, candidates, jobs and applications.
            </p>
          )}
        </CardContent>
      </Card>

      {auditAlerts.length > 0 && (
        <section aria-label="Security alerts">
          {auditAlerts.map((alert, i) => (
            <Alert key={i} tone={alert.severity === "high" ? "error" : "warning"}>
              <strong>Security alert:</strong> {alert.message}
            </Alert>
          ))}
        </section>
      )}

      <section aria-label="Platform metrics" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Organizations" value={orgs.length} />
        <Stat
          label="Pending org approvals"
          value={orgs.filter((o) => o.verification_status === "pending").length}
        />
        <Stat label="Internal users" value={internalUserIds.size} hint="Users with org-scoped roles" />
        <Stat
          label="Active accounts"
          value={profiles.filter((p) => p.is_active).length}
          hint={`${profiles.filter((p) => !p.is_active).length} suspended`}
        />
        <Stat label="Candidates" value={(candidatesRes.data ?? []).length} />
        <Stat
          label="Active vacancies"
          value={jobs.filter((j) => j.status === "published").length}
        />
        <Stat label="Draft vacancies" value={jobs.filter((j) => j.status === "draft").length} />
        <Stat
          label="Pending job approvals"
          value={jobs.filter((j) => j.status === "pending_review").length}
        />
        <Stat label="Total applications" value={apps.length} />
        <Stat
          label="Interviews scheduled"
          value={interviews.filter((i) => i.status === "scheduled").length}
          hint="Upcoming"
        />
        <Stat
          label="Offers pending approval"
          value={offers.filter((o) => o.status === "pending_approval").length}
        />
        <Stat label="Hires" value={(hiresRes.data ?? []).length} />
      </section>

      {/* Phase 2: Free-tier headroom monitor — alerts before hitting Supabase/Vercel limits. */}
      <Card>
        <CardHeader>
          <CardTitle>Free-tier headroom</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <HeadroomMetric
              label="Users"
              current={profiles.length}
              limit={50000}
              unit="users"
            />
            <HeadroomMetric
              label="Jobs"
              current={jobs.length}
              limit={100000}
              unit="jobs"
              note="DB rows, not a hard limit"
            />
            <HeadroomMetric
              label="Applications"
              current={apps.length}
              limit={500000}
              unit="applications"
              note="DB rows, not a hard limit"
            />
            <HeadroomMetric
              label="Storage buckets"
              current={bucketNames.size}
              limit={100}
              unit="buckets"
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Supabase free tier: 500MB database, 1GB storage, 50K monthly active users.
            Vercel free tier: 100GB bandwidth/month. These are soft estimates —
            check the Supabase and Vercel dashboards for exact usage.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications by stage</CardTitle>
          </CardHeader>
          <CardContent>
            {stageCounts.size === 0 ? (
              <p className="text-sm text-slate-500">No applications in range.</p>
            ) : (
              <ul className="space-y-2">
                {[...stageCounts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([stage, count]) => (
                    <li key={stage} className="flex items-center justify-between text-sm">
                      <span>{stageLabels.get(stage) ?? stage}</span>
                      <Badge tone="info">{count}</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System config status</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>Environment variables</span>
                <Badge tone={envStatus === "ok" ? "success" : "danger"}>{envStatus}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span>Email provider (Resend)</span>
                <Badge tone={emailStatus === "configured" ? "success" : "warning"}>
                  {emailStatus}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span>Storage buckets</span>
                {missingBuckets.length === 0 ? (
                  <Badge tone="success">all present</Badge>
                ) : (
                  <Badge tone="danger">missing: {missingBuckets.join(", ")}</Badge>
                )}
              </li>
              <li className="flex items-center justify-between">
                <span>Operating mode</span>
                <Badge tone="neutral">{String(operatingMode)}</Badge>
              </li>
            </ul>
            {emailStatus === "unconfigured" && (
              <div className="mt-3">
                <Alert tone="warning">
                  Email is unconfigured (RESEND_API_KEY / EMAIL_FROM_ADDRESS missing). Sends will
                  be reported honestly as unconfigured — nothing will claim delivery.
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recently created accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {asRows<{ id: string; email: string; display_name: string | null; created_at: string }>(recentProfilesRes.data).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link className="text-brand-700 hover:underline" href={`/control-center/users/${p.id}`}>
                        {(p.email as string) ?? "—"}
                      </Link>
                      <div className="text-xs text-slate-500">{(p.display_name as string) ?? ""}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {timeAgo(p.created_at as string)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent admin actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Action</TableHeaderCell>
                  <TableHeaderCell>Entity</TableHeaderCell>
                  <TableHeaderCell>When</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(recentAuditRes.data ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.action as string}</TableCell>
                    <TableCell className="text-slate-500">{a.entity_type as string}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {timeAgo(a.created_at as string)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Failed / pending notification deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {(deliveriesRes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No failed or pending deliveries.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Notification</TableHeaderCell>
                  <TableHeaderCell>Channel</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Attempted</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(deliveriesRes.data ?? []).map((d) => {
                  const notif = d.notification as { title?: string } | null;
                  return (
                    <TableRow key={d.id}>
                      <TableCell>{notif?.title ?? "—"}</TableCell>
                      <TableCell>
                        <Badge tone="neutral">{d.channel as string}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge tone={d.status === "failed" ? "danger" : "warning"}>
                          {d.status as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDateKarachi(d.attempted_at as string)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * Phase 2: Free-tier headroom metric.
 * Shows current usage vs limit with a color-coded progress bar.
 */
function HeadroomMetric({
  label,
  current,
  limit,
  unit,
  note,
}: {
  label: string;
  current: number;
  limit: number;
  unit: string;
  note?: string;
}) {
  const pct = Math.min(100, Math.round((current / limit) * 100));
  const tone = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">
          {current.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {pct}% of {unit} limit{note ? ` · ${note}` : ""}
      </p>
    </div>
  );
}
