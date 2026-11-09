import { Badge } from "@/components/ui/Badge";
import { formatDateOnlyKarachi } from "@/lib/format";
import type { ResponseStatus } from "@/lib/response-deadline";

/**
 * Chip rendering for the 5–7 business-day response rule.
 *
 * - audience "candidate": "Response due by <date>" while waiting, and a
 *   clear "No response from employer" after a breach. Nothing is rendered
 *   once the employer has responded (the stage badge already says it).
 * - audience "employer": a countdown for applications still in `applied`
 *   ("5 days left", "Due today", "Overdue by 2 days"). Nothing is rendered
 *   once responded or withdrawn.
 */
export function ResponseStatusChip({
  status,
  audience,
  className = "",
}: {
  status: ResponseStatus;
  audience: "candidate" | "employer";
  className?: string;
}) {
  if (audience === "candidate") {
    if (status.kind === "awaiting") {
      return (
        <Badge tone="info" className={className}>
          Response due by {formatDateOnlyKarachi(status.deadline)}
        </Badge>
      );
    }
    if (status.kind === "due-soon") {
      return (
        <Badge tone="warning" className={className}>
          Response due by {formatDateOnlyKarachi(status.deadline)}
        </Badge>
      );
    }
    if (status.kind === "no-response") {
      return (
        <Badge tone="danger" className={className}>
          No response from employer
        </Badge>
      );
    }
    return null;
  }

  // Employer countdown.
  return (
    <EmployerResponseChip
      kind={status.kind}
      businessDaysLeft={status.businessDaysLeft}
      className={className}
    />
  );
}

/**
 * Serializable employer countdown chip (for client components like the
 * applications table and pipeline board, where a full ResponseStatus with
 * Date objects cannot cross the server/client boundary).
 */
export function EmployerResponseChip({
  kind,
  businessDaysLeft,
  className = "",
}: {
  kind: string;
  businessDaysLeft: number;
  className?: string;
}) {
  if (kind !== "awaiting" && kind !== "due-soon" && kind !== "no-response") {
    return null;
  }
  if (kind === "no-response") {
    const overdue = Math.abs(businessDaysLeft);
    return (
      <Badge tone="danger" className={className}>
        Overdue{overdue > 0 ? ` by ${overdue} day${overdue === 1 ? "" : "s"}` : ""}
      </Badge>
    );
  }
  if (businessDaysLeft <= 0) {
    return (
      <Badge tone="warning" className={className}>
        Due today
      </Badge>
    );
  }
  return (
    <Badge tone={kind === "due-soon" ? "warning" : "info"} className={className}>
      {businessDaysLeft} day{businessDaysLeft === 1 ? "" : "s"} left to respond
    </Badge>
  );
}
