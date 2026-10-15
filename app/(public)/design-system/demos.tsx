"use client";

import * as React from "react";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { CandidateCard } from "@/app/(employer)/_components/CandidateCard";

/** Interactive design-system demos (client-only state). */

export function PaginationDemo() {
  const [page, setPage] = React.useState(3);
  return <Pagination page={page} totalPages={8} onChange={setPage} />;
}

export function TabsDemo() {
  return (
    <Tabs
      ariaLabel="Demo tabs"
      tabs={[
        { id: "board", label: "Board", content: <p className="pt-3 text-sm text-slate-600">Board view content.</p> },
        { id: "table", label: "Table", content: <p className="pt-3 text-sm text-slate-600">Table view content.</p> },
      ]}
    />
  );
}

export function PipelineCandidateCardPreview() {
  return (
    <CandidateCard
      card={{
        id: "demo",
        candidateName: "Hira Shahid",
        candidateHeadline: "Frontend Developer · React",
        jobTitle: "Frontend Developer",
        submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        assignees: ["Danish Iqbal", "Sana Malik"],
        detailHref: "#",
      }}
    />
  );
}

type DemoRow = { name: string; stage: string; tone: "blue" | "violet" | "amber"; score: number; applied: string };

/**
 * DataTable demo lives here (client component) because column definitions
 * contain render/sort functions, which cannot be passed from a Server
 * Component to a Client Component.
 */
export function DataTableDemo() {
  return (
    <DataTable<DemoRow>
      caption="Demo candidates"
      columns={[
        { key: "name", header: "Candidate", render: (r) => <span className="font-medium text-slate-900">{r.name}</span>, sortable: true, sortValue: (r) => r.name },
        { key: "stage", header: "Stage", render: (r) => <StatusPill tone={r.tone}>{r.stage}</StatusPill> },
        { key: "score", header: "Score", render: (r) => `${r.score}/10`, sortable: true, sortValue: (r) => r.score, className: "text-end" },
        { key: "applied", header: "Applied", render: (r) => r.applied },
      ]}
      rows={[
        { name: "Hira Shahid", stage: "Applied", tone: "blue", score: 8, applied: "11-Oct-2026" },
        { name: "Danish Iqbal", stage: "Screening", tone: "violet", score: 7, applied: "10-Oct-2026" },
        { name: "Sana Malik", stage: "Interview", tone: "amber", score: 9, applied: "09-Oct-2026" },
      ]}
      rowKey={(r) => r.name}
    />
  );
}
