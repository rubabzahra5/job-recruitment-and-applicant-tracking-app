import type { Metadata } from "next";

import {
  AdminDeniedError,
  adminPageGuard,
  asRows,
  getPagination,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { PaginationNav } from "@/app/(admin)/_components/filters";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { formatDateKarachi } from "@/lib/format";

export const metadata: Metadata = { title: "Control Center — Scam reports" };
export const dynamic = "force-dynamic";

interface ScamReportRow {
  id: string;
  created_at: string;
  reporter_name: string | null;
  reporter_email: string | null;
  job_id: string | null;
  job_url: string | null;
  organization_name: string | null;
  scam_type: string;
  description: string;
  evidence_urls: string | null;
  status: string;
}

const TYPE_LABELS: Record<string, string> = {
  money_asked: "Money asked",
  fake_job: "Fake job",
  impersonation: "Impersonation",
  phishing: "Phishing / credentials",
  other: "Other",
};

const STATUS_TONES: Record<string, "warning" | "info" | "success" | "neutral"> = {
  new: "warning",
  reviewing: "info",
  action_taken: "success",
  dismissed: "neutral",
};

function excerpt(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export default async function ScamReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/scam-reports"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params, 30);

  const { data, count, error } = await admin
    .from("scam_reports")
    .select(
      "id,created_at,reporter_name,reporter_email,job_id,job_url,organization_name,scam_type,description,evidence_urls,status",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  // FAIL-SOFT: until migration 0019 runs, the table does not exist — show
  // a setup state instead of crashing (the feed pattern).
  if (error) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scam reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Reports submitted from the public /report-scam page.
          </p>
        </div>
        <EmptyState
          title="Scam reports are being set up"
          description="The scam_reports table is not available yet. Run migration 0019 (supabase/migrations/0019_scam_reports.sql) in the Supabase SQL editor, then this queue will appear here."
        />
      </main>
    );
  }

  const rows = asRows<ScamReportRow>(data);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scam reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          {count ?? 0} report{count === 1 ? "" : "s"} from the public
          /report-scam page, newest first. Read-only in this phase — act on a
          report from the organisation&apos;s control-center page and record
          the outcome in the audit log.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No scam reports yet"
          description="When a candidate or visitor reports a suspected scam job, it will appear here for review."
        />
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Received</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Organisation</TableHeaderCell>
                  <TableHeaderCell>Job</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>What happened</TableHeaderCell>
                  <TableHeaderCell>Reporter</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateKarachi(r.created_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {TYPE_LABELS[r.scam_type] ?? r.scam_type}
                    </TableCell>
                    <TableCell>{r.organization_name ?? "—"}</TableCell>
                    <TableCell>
                      {r.job_url ? (
                        <span className="break-all text-xs">{r.job_url}</span>
                      ) : r.job_id ? (
                        <span className="text-xs">{r.job_id}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONES[r.status] ?? "neutral"}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span title={r.description}>{excerpt(r.description)}</span>
                      {r.evidence_urls && (
                        <span className="mt-1 block break-all text-xs text-slate-500">
                          Evidence: {excerpt(r.evidence_urls, 80)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.reporter_name ?? "Anonymous"}
                      {r.reporter_email && (
                        <span className="block text-slate-500">{r.reporter_email}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationNav page={page} totalPages={totalPages} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
