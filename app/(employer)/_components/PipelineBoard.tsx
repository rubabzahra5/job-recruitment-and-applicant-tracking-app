"use client";

import * as React from "react";
import { Inbox } from "lucide-react";
import { StatusPill, stageTone } from "@/components/ui/StatusPill";
import { CandidateCard, type CandidateCardData } from "./CandidateCard";
import type { ActionResult } from "../_lib/org";

export interface BoardStage {
  key: string;
  label: string;
  is_terminal: boolean;
}

interface PipelineBoardProps {
  orgId: string;
  stages: BoardStage[];
  /** Cards grouped by stage key. */
  cardsByStage: Map<string, CandidateCardData[]>;
  /** For each stage key, the set of stage keys a card may move to. */
  allowedTargets: Map<string, string[]>;
  stageLabel: (key: string) => string;
  moveAction: (orgId: string, applicationId: string, toStage: string) => Promise<ActionResult>;
  canManage: boolean;
}

/**
 * Premium Kanban pipeline board.
 * - Native HTML5 drag-and-drop (no heavy libraries, free-tier friendly)
 * - Drops restricted to server-validated transitions; invalid targets dimmed
 * - Sticky column headers, tabular-nums counts, per-column empty states
 * - Loading shimmer on the moving card, inline error on failure
 * - Keyboard-accessible fallback: cards keep their detail link; the
 *   existing StageMoveControl remains on the detail page
 */
export function PipelineBoard({
  orgId,
  stages,
  cardsByStage,
  allowedTargets,
  stageLabel,
  moveAction,
  canManage,
}: PipelineBoardProps) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragFrom, setDragFrom] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const [movingId, setMovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const total = [...cardsByStage.values()].reduce((n, c) => n + c.length, 0);

  const handleDragStart = (e: React.DragEvent, id: string, fromStage: string) => {
    if (!canManage) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(id);
    setDragFrom(fromStage);
    setError(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragFrom(null);
    setDropTarget(null);
  };

  const isValidTarget = (stageKey: string) =>
    dragFrom != null && (allowedTargets.get(dragFrom) ?? []).includes(stageKey);

  const handleDrop = async (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDropTarget(null);
    if (!id || !isValidTarget(stageKey) || !canManage) {
      handleDragEnd();
      return;
    }
    setMovingId(id);
    setError(null);
    try {
      const result = await moveAction(orgId, id, stageKey);
      if (!result.ok) {
        setError(result.error);
      } else {
        window.location.reload();
      }
    } finally {
      setMovingId(null);
      handleDragEnd();
    }
  };

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Couldn&apos;t move the candidate: {error}
        </p>
      )}
      <div
        className="flex gap-4 overflow-x-auto pb-4"
        role="list"
        aria-label={`Hiring pipeline, ${total} candidates total`}
      >
        {stages.map((stage) => {
          const cards = cardsByStage.get(stage.key) ?? [];
          const valid = dragId != null && isValidTarget(stage.key);
          const isDropTarget = dropTarget === stage.key;
          return (
            <section
              key={stage.key}
              role="listitem"
              aria-label={`${stage.label}, ${cards.length} candidates`}
              onDragOver={(e) => {
                if (valid) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget(stage.key);
                }
              }}
              onDragLeave={() => setDropTarget((t) => (t === stage.key ? null : t))}
              onDrop={(e) => handleDrop(e, stage.key)}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border transition-colors duration-200 ${
                isDropTarget
                  ? "border-brand-400 bg-brand-50/60"
                  : "border-slate-200 bg-slate-50/80"
              } ${dragId != null && !valid && !stage.is_terminal ? "opacity-60" : ""}`}
            >
              {/* Sticky column header */}
              <header className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-2xl border-b border-slate-200/80 bg-slate-50/95 px-3 py-2.5 backdrop-blur">
                <StatusPill tone={stageTone(stage.key)} className="font-semibold">
                  {stage.label}
                </StatusPill>
                <span
                  className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-xs font-semibold text-slate-600 tabular-nums"
                  aria-label={`${cards.length} in ${stage.label}`}
                >
                  {cards.length}
                </span>
              </header>

              {/* Cards */}
              <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto p-2.5">
                {cards.map((card) => (
                  <div key={card.id} className={movingId === card.id ? "animate-pulse" : ""}>
                    <CandidateCard
                      card={card}
                      draggable={canManage && !stage.is_terminal}
                      dragging={dragId === card.id}
                      onDragStart={(e, id) => handleDragStart(e, id, stage.key)}
                      onDragEnd={handleDragEnd}
                    />
                  </div>
                ))}
                {cards.length === 0 && (
                  <div
                    className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-3 py-8 text-center transition-colors ${
                      isDropTarget ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-400"
                    }`}
                  >
                    <Inbox className="h-6 w-6" aria-hidden="true" />
                    <p className="mt-2 text-xs font-medium">
                      {isDropTarget ? `Drop here to move to ${stage.label}` : "No candidates"}
                    </p>
                    {valid && !isDropTarget && (
                      <p className="mt-1 text-[11px]">Drop to move to {stage.label}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Column footer: allowed next steps hint while dragging */}
              {dragId != null && valid && (
                <p className="border-t border-brand-200 bg-brand-50/50 px-3 py-1.5 text-[11px] font-medium text-brand-700">
                  Release to move here
                </p>
              )}
            </section>
          );
        })}
      </div>
      {canManage && (
        <p className="mt-1 text-xs text-slate-400">
          Tip: drag a card to another column to move it. The candidate is notified automatically.
        </p>
      )}
    </div>
  );
}
