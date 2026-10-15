"use client";

import * as React from "react";
import { ArrowDownWideNarrow } from "lucide-react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  density?: "comfortable" | "compact";
  onDensityChange?: (d: "comfortable" | "compact") => void;
  caption?: string;
  emptyState?: React.ReactNode;
}

/**
 * DataTable: sticky header, row hover, sortable columns,
 * density toggle (comfortable/compact), tabular numbers.
 */
export function DataTable<T>({ columns, rows, rowKey, density: controlled, onDensityChange, caption, emptyState }: DataTableProps<T>) {
  const [internal, setInternal] = React.useState<"comfortable" | "compact">("comfortable");
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<1 | -1>(1);
  const density = controlled ?? internal;
  const setDensity = onDensityChange ?? setInternal;

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
  }, [rows, sortKey, sortDir, columns]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const cellPad = density === "compact" ? "px-3 py-1.5" : "px-4 py-3";

  return (
    <div>
      <div className="mb-2 flex items-center justify-end">
        <div
          className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"
          role="group"
          aria-label="Table density"
        >
          {(["comfortable", "compact"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDensity(d)}
              aria-pressed={density === d}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                density === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden="true" />
              {d === "comfortable" ? "Comfort" : "Compact"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse bg-white text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sortKey === c.key ? (sortDir === 1 ? "ascending" : "descending") : undefined}
                  className={`whitespace-nowrap text-start text-xs font-semibold uppercase tracking-wider text-slate-500 ${cellPad} ${c.className ?? ""}`}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                    >
                      {c.header}
                      <span aria-hidden="true" className="text-slate-400">
                        {sortKey === c.key ? (sortDir === 1 ? "▲" : "▼") : "△"}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-brand-50/50">
                {columns.map((c) => (
                  <td key={c.key} className={`${cellPad} text-slate-700 tabular-nums ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (emptyState ?? <p className="p-8 text-center text-sm text-slate-500">No rows.</p>)}
      </div>
    </div>
  );
}
