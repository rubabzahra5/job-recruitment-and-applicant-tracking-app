"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import type { CvUrlResult } from "../employer/applications/actions";

/** Generates a short-lived signed CV URL server-side (after RBAC) and opens it. */
export function CvViewer({
  getUrl,
  hasCv,
}: {
  getUrl: () => Promise<CvUrlResult>;
  hasCv: boolean;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!hasCv) return <p className="text-sm text-slate-500">No CV attached to this application.</p>;

  const open = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUrl();
      if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
      else setError(res.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="outline" onClick={open} isLoading={loading}>
        View CV
      </Button>
      <p className="mt-1 text-xs text-slate-500">Opens a time-limited secure link (10 minutes).</p>
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
