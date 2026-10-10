import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { getOrgContext, NoOrganizationError } from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { CsvDownloadButton } from "../../_components/CsvDownloadButton";
import { getReportData, getReportJobs, exportReportCsv } from "./actions";

export const metadata: Metadata = { title: "Reports" };

interface SearchParams {
  org?: string;
  from?: string;
  to?: string;
  jobId?: string;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  if (!["org_admin", "hr_manager", "recruiter"].includes(ctx.role)) {
    return (
      <main>
        <EmptyState title="Not authorized" description="Reports require a recruiter role or higher." />
      </main>
    );
  }

  const filters = { from: sp.from, to: sp.to, jobId: sp.jobId };
  const [data, jobs] = await Promise.all([getReportData(ctx.orgId, filters), getReportJobs(ctx.orgId)]);

  const byJob = new Map<string, { title: string; department: string; count: number; hired: number }>();
  for (const r of data.rows) {
    const entry = byJob.get(r.jobTitle) ?? { title: r.jobTitle, department: r.department, count: 0, hired: 0 };
    entry.count++;
    if (r.hiredAt) entry.hired++;
    byJob.set(r.jobTitle, entry);
  }

  return (
    <main>
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        Scoped to {ctx.org.name}. Exports are bounded (2,000 rows) and limited to authorized columns —
        no candidate contact details; salary columns only for org admins and HR managers.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input type="hidden" name="org" value={ctx.orgId} />
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          From
          <input type="date" name="from" defaultValue={sp.from ?? ""} aria-label="From date" className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          To
          <input type="date" name="to" defaultValue={sp.to ?? ""} aria-label="To date" className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Vacancy
          <select name="jobId" defaultValue={sp.jobId ?? ""} aria-label="Filter by vacancy" className="h-9 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">All vacancies</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" size="sm">Apply</Button>
      </form>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Applications" value={data.rows.length} />
        <Stat label="Hires" value={data.hires} />
        <Stat
          label="Avg. time to hire"
          value={data.avgDaysToHire !== null ? `${data.avgDaysToHire.toFixed(1)} days` : "—"}
          hint="hired_at − submitted_at"
        />
        <Stat label="Vacancies in report" value={byJob.size} />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Applications by stage</CardTitle>
              <CsvDownloadButton
                report="applications_by_stage"
                filters={filters}
                label="Export CSV"
                exportAction={exportReportCsv}
                orgId={ctx.orgId}
              />
            </div>
          </CardHeader>
          <CardContent>
            {data.stageCounts.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              <ul className="space-y-1.5">
                {data.stageCounts.map((s) => (
                  <li key={s.stage} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{s.stage}</span>
                    <span className="font-medium tabular-nums">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Time to hire</CardTitle>
              <CsvDownloadButton
                report="time_to_hire"
                filters={filters}
                label="Export CSV"
                exportAction={exportReportCsv}
                orgId={ctx.orgId}
              />
            </div>
          </CardHeader>
          <CardContent>
            {data.hires === 0 ? (
              <EmptyState title="No hires in this period" description="Time-to-hire is computed from hiring records (hired_at − submitted_at)." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Candidate</TableHeaderCell>
                      <TableHeaderCell>Vacancy</TableHeaderCell>
                      <TableHeaderCell>Days to hire</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.rows.filter((r) => r.hiredAt).slice(0, 10).map((r) => (
                      <TableRow key={r.applicationId}>
                        <TableCell>{r.candidateName}</TableCell>
                        <TableCell>{r.jobTitle}</TableCell>
                        <TableCell className="tabular-nums">{r.daysToHire}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {data.rows.filter((r) => r.hiredAt).length > 10 && (
                  <p className="mt-2 text-xs text-slate-500">Showing 10 of {data.hires} — export for the full list.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Applications by vacancy</CardTitle>
            <CsvDownloadButton
              report="applications_by_job"
              filters={filters}
              label="Export CSV"
              exportAction={exportReportCsv}
              orgId={ctx.orgId}
            />
          </div>
        </CardHeader>
        <CardContent>
          {byJob.size === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Vacancy</TableHeaderCell>
                  <TableHeaderCell>Department</TableHeaderCell>
                  <TableHeaderCell>Applications</TableHeaderCell>
                  <TableHeaderCell>Hires</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...byJob.values()].map((j) => (
                  <TableRow key={j.title}>
                    <TableCell className="font-medium">{j.title}</TableCell>
                    <TableCell>{j.department}</TableCell>
                    <TableCell className="tabular-nums">{j.count}</TableCell>
                    <TableCell className="tabular-nums">{j.hired}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Note: application-source tracking is not part of the database schema, so source statistics are not available;
        the vacancy breakdown above is the closest real metric. All exports are written to the audit log.
      </p>
    </main>
  );
}
