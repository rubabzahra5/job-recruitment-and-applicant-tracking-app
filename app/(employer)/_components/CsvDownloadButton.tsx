"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import type { CsvExportResult, ReportFilters } from "../employer/reports/actions";

/** Triggers a scoped CSV export via a server action and downloads the file. */
export function CsvDownloadButton({
  report,
  filters,
  label,
  exportAction,
  orgId,
}: {
  report: "applications_by_stage" | "time_to_hire" | "applications_by_job";
  filters: ReportFilters;
  label: string;
  exportAction: (orgId: string, report: "applications_by_stage" | "time_to_hire" | "applications_by_job", filters: ReportFilters) => Promise<CsvExportResult>;
  orgId: string;
}) {
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const download = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await exportAction(orgId, report, filters);
      if (!res.ok || !res.csv) {
        setError(!res.ok ? res.error : "Export failed.");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename ?? `${report}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setWorking(false);
    }
  };

  return (
    <span>
      <Button variant="outline" size="sm" onClick={download} isLoading={working}>
        {label}
      </Button>
      {error && (
        <span className="ml-2 text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
