"use client";

import * as React from "react";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
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
