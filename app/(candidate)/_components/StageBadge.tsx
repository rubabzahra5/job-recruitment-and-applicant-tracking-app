import { Badge } from "@/components/ui/Badge";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const STAGE_META: Record<string, { label: string; tone: Tone }> = {
  applied: { label: "Applied", tone: "info" },
  initial_screening: { label: "Initial Screening", tone: "info" },
  shortlisted: { label: "Shortlisted", tone: "info" },
  assessment: { label: "Assessment", tone: "warning" },
  interview_scheduled: { label: "Interview Scheduled", tone: "warning" },
  interview_completed: { label: "Interview Completed", tone: "warning" },
  reference_check: { label: "Reference Check", tone: "warning" },
  offer_pending: { label: "Offer Pending", tone: "warning" },
  offer_accepted: { label: "Offer Accepted", tone: "success" },
  offer_declined: { label: "Offer Declined", tone: "neutral" },
  hired: { label: "Hired", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

/** Human-readable label for a pipeline stage key (falls back to the key). */
export function stageLabel(stage: string): string {
  return STAGE_META[stage]?.label ?? stage;
}

/** Colored badge for an application pipeline stage. */
export function StageBadge({ stage, className = "" }: { stage: string; className?: string }) {
  const meta = STAGE_META[stage] ?? { label: stage, tone: "neutral" as Tone };
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
