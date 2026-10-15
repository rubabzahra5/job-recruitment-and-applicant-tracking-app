"use client";

import Link from "next/link";
import { Clock3, GripVertical } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatDateOnlyKarachi, timeAgo } from "@/lib/format";

export interface CandidateCardData {
  id: string;
  candidateName: string;
  candidateHeadline: string | null;
  jobTitle: string;
  submittedAt: string;
  assignees: string[];
  detailHref: string;
}

interface CandidateCardProps {
  card: CandidateCardData;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: () => void;
}

/**
 * Premium candidate card for the pipeline board.
 * Avatar + name + headline, job context, time-in-stage (tabular-nums),
 * assignee avatars. Subtle hover lift, visible drag handle, focus ring.
 */
export function CandidateCard({ card, draggable = false, dragging = false, onDragStart, onDragEnd }: CandidateCardProps) {
  return (
    <article
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, card.id) : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      className={`group relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-within:ring-2 focus-within:ring-brand-600 ${
        dragging ? "opacity-40 ring-2 ring-brand-500" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        {draggable && (
          <span
            aria-hidden="true"
            className="mt-1 cursor-grab text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </span>
        )}
        <Avatar name={card.candidateName} size="sm" />
        <div className="min-w-0 flex-1">
          <Link
            href={card.detailHref}
            className="block truncate text-sm font-semibold text-slate-900 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
          >
            {card.candidateName}
          </Link>
          {card.candidateHeadline && (
            <p className="truncate text-xs text-slate-500">{card.candidateHeadline}</p>
          )}
        </div>
      </div>

      <p className="mt-2 truncate text-xs font-medium text-slate-600">{card.jobTitle}</p>

      <div className="mt-2 flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1 text-xs text-slate-400 tabular-nums"
          title={`Applied ${formatDateOnlyKarachi(card.submittedAt)}`}
        >
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {timeAgo(card.submittedAt)}
        </span>
        {card.assignees.length > 0 && (
          <span className="flex -space-x-1.5" title={`Assigned: ${card.assignees.join(", ")}`}>
            {card.assignees.slice(0, 3).map((name) => (
              <Avatar key={name} name={name} size="xs" className="ring-2 ring-white" />
            ))}
            {card.assignees.length > 3 && (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ring-2 ring-white">
                +{card.assignees.length - 3}
              </span>
            )}
          </span>
        )}
      </div>
    </article>
  );
}
