"use client";

import * as React from "react";

export interface PaginationProps {
  page: number; // 1-based
  totalPages: number;
  onChange: (page: number) => void;
  ariaLabel?: string;
}

function pageItems(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages]);
  const sorted = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const items: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) items.push("…");
    items.push(n);
  }
  return items;
}

export function Pagination({ page, totalPages, onChange, ariaLabel = "Pagination" }: PaginationProps) {
  if (totalPages <= 1) return null;
  const btn =
    "min-w-9 rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600";

  return (
    <nav aria-label={ariaLabel} className="flex items-center gap-1">
      <button
        type="button"
        className={btn}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Go to previous page"
      >
        ‹
      </button>
      {pageItems(page, totalPages).map((item, i) =>
        item === "…" ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={`${btn} ${item === page ? "bg-brand-600 text-white border-brand-600 hover:bg-brand-700" : ""}`}
            aria-label={`Go to page ${item}`}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={btn}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Go to next page"
      >
        ›
      </button>
    </nav>
  );
}
