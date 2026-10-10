import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AdminDeniedError,
  adminPageGuard,
  asRows,
  firstParam,
  getPagination,
  parseDateRange,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { FilterBar, PaginationNav } from "@/app/(admin)/_components/filters";
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

export const metadata: Metadata = { title: "Control Center — Audit logs" };
export const dynamic = "force-dynamic";

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  actor: { email?: string } | null;
  org: { name?: string } | null;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/audit-logs"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params, 30);
  const range = parseDateRange(params);
  const actorEmail = (firstParam(params.actor) ?? "").trim();
  const action = (firstParam(params.action) ?? "").trim();
  const entityType = firstParam(params.entity) ?? "";
  const orgId = firstParam(params.org) ?? "";

  let actorIds: string[] | null = null;
  if (actorEmail) {
    const { data: matches } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", `%${actorEmail}%`)
      .limit(100);
    actorIds = (matches ?? []).map((m) => m.id as string);
    if (actorIds.length === 0) actorIds = ["00000000-0000-0000-0000-000000000000"];
  }

  let query = admin
    .from("audit_logs")
    .select(
      "id,action,entity_type,entity_id,created_at,metadata," +
        "actor:profiles!audit_logs_actor_user_id_fkey(email)," +
        "org:organizations(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (range.from) query = query.gte("created_at", range.from);
  if (range.to) query = query.lt("created_at", range.to);
  if (actorIds) query = query.in("actor_user_id", actorIds);
  if (action) query = query.ilike("action", `%${action}%`);
  if (entityType) query = query.eq("entity_type", entityType);
  if (orgId) query = query.eq("org_id", orgId);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(`Failed to load audit logs: ${error.message}`);
  const rows = asRows<AuditLogRow>(data);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  const [entityTypesRes, orgsRes] = await Promise.all([
    admin.from("audit_logs").select("entity_type").limit(500),
    admin.from("organizations").select("id,name").order("name").limit(200),
  ]);
  const entityTypes = [...new Set((entityTypesRes.data ?? []).map((r) => r.entity_type as string))].sort();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit logs</h1>
        <p className="mt-1 text-sm text-slate-600">
          {count ?? 0} entries. Immutable (INSERT-only); read-only here.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Suspense>
            <FilterBar
              fields={[
                { key: "actor", label: "Actor email", type: "search", placeholder: "admin@example.com" },
                { key: "action", label: "Action contains", type: "search", placeholder: "job.approved" },
                {
                  key: "entity",
                  label: "Entity type",
                  type: "select",
                  options: entityTypes.map((e) => ({ value: e, label: e })),
                },
                {
                  key: "org",
                  label: "Organization",
                  type: "select",
                  options: (orgsRes.data ?? []).map((o) => ({ value: o.id as string, label: o.name as string })),
                },
                { key: "from", label: "From", type: "date" },
                { key: "to", label: "To", type: "date" },
              ]}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Entries</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>When (PKT)</TableHeaderCell>
                <TableHeaderCell>Actor</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>Entity</TableHeaderCell>
                <TableHeaderCell>Org</TableHeaderCell>
                <TableHeaderCell>Metadata</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((a) => {
                const actor = a.actor as { email?: string } | null;
                const org = a.org as { name?: string } | null;
                const meta = a.metadata as Record<string, unknown>;
                return (
                  <TableRow key={a.id as string}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateKarachi(a.created_at as string)}
                    </TableCell>
                    <TableCell className="max-w-44 truncate text-xs">{actor?.email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{a.action as string}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {a.entity_type as string}
                      {a.entity_id ? (
                        <span className="block font-mono text-[10px]">{String(a.entity_id).slice(0, 8)}…</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{org?.name ?? "—"}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-[11px] text-slate-500" title={JSON.stringify(meta)}>
                      {JSON.stringify(meta)}
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
    </main>
  );
}
