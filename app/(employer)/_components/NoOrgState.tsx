"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/** Shown when the signed-in user has no active organization membership. */
export function NoOrgState() {
  return (
    <EmptyState
      title="No organization yet"
      description="Your account is not a member of any hiring organization. Ask an organization admin to invite you, or accept a pending invitation."
      action={
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      }
    />
  );
}
