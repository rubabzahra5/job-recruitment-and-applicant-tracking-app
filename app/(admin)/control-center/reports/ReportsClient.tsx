"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const EXPORTS: {
  kind: string;
  title: string;
  description: string;
  columns: string;
}[] = [
  {
    kind: "summary",
    title: "Platform summary",
    description: "Key counts (orgs, users, jobs, applications by stage, interviews, offers, hires).",
    columns: "metric, value",
  },
  {
    kind: "users",
    title: "Users",
    description: "All accounts with roles and organization memberships.",
    columns: "id, email, display_name, is_active, roles, organizations, created_at",
  },
  {
    kind: "orgs",
    title: "Organizations",
    description: "All organizations with verification and account status.",
    columns: "id, name, slug, verification_status, account_status, industry, contact_email, created_at",
  },
  {
    kind: "jobs",
    title: "Jobs",
    description: "All jobs with organization, category, location, status and application counts.",
    columns: "id, title, organization, category, location, status, employment_type, workplace, applications, published_at, created_at",
  },
  {
    kind: "applications",
    title: "Applications",
    description: "All applications with candidate email, job, organization and stage.",
    columns: "id, candidate_email, job_title, organization, stage, submitted_at",
  },
];

export function ReportsClient() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  function href(kind: string): string {
    const params = new URLSearchParams({ kind });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/control-center/export?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Date range (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="rep-from" className="mb-1 block text-xs font-medium text-slate-600">From</label>
              <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rep-to" className="mb-1 block text-xs font-medium text-slate-600">To</label>
              <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>
              Clear
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Applies to created/submitted dates. Exports are capped at 5,000 rows and every
            download is written to audit_logs (report.exported).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {EXPORTS.map((e) => (
          <Card key={e.kind}>
            <CardHeader>
              <CardTitle>{e.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">{e.description}</p>
              <p className="mt-2 font-mono text-xs text-slate-500">Columns: {e.columns}</p>
              <div className="mt-4">
                <a
                  href={href(e.kind)}
                  download
                  className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Download CSV
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
