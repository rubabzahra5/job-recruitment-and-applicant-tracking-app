"use client";

import { Select } from "@/components/ui/Select";

const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "newest", label: "Newest first" },
  { value: "deadline", label: "Deadline: soonest" },
  { value: "salary", label: "Highest salary" },
];

/** Sort control for the jobs catalog: re-submits the filter form on change. */
export function SortSelect({
  current,
  preserved,
}: {
  current: string;
  /** Other query params to keep (without sort/page). */
  preserved: Record<string, string>;
}) {
  return (
    <form method="get" action="/jobs" className="flex items-center gap-2">
      {Object.entries(preserved).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="sort" className="text-sm text-slate-600">Sort by</label>
      <Select
        id="sort"
        name="sort"
        defaultValue={current}
        className="w-44"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </form>
  );
}
