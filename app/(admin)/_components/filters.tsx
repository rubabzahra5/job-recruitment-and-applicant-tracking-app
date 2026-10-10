"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";

export interface FilterField {
  key: string;
  label: string;
  type: "search" | "select" | "date";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

/**
 * URL-driven filter bar. Submitting rewrites the query string (resetting
 * `page`); the server component re-renders with the new filters. Must be
 * rendered inside <Suspense> (uses useSearchParams).
 */
export function FilterBar({
  fields,
  submitLabel = "Apply filters",
}: {
  fields: FilterField[];
  submitLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = searchParams.get(f.key) ?? "";
    return init;
  });

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    for (const f of fields) {
      const v = (values[f.key] ?? "").trim();
      if (v) params.set(f.key, v);
      else params.delete(f.key);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clear() {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = "";
    setValues(init);
    router.push(pathname);
  }

  return (
    <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
      {fields.map((f) => (
        <div key={f.key} className={f.type === "search" ? "min-w-48 flex-1" : ""}>
          <label htmlFor={`filter-${f.key}`} className="mb-1 block text-xs font-medium text-slate-600">
            {f.label}
          </label>
          {f.type === "select" ? (
            <Select
              id={`filter-${f.key}`}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            >
              <option value="">All</option>
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={`filter-${f.key}`}
              type={f.type === "date" ? "date" : "search"}
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" size="sm">
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
      </div>
    </form>
  );
}

/** URL-driven pagination wrapper around the Pagination primitive. */
export function PaginationNav({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex justify-center">
      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={(p) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("page", String(p));
          router.push(`${pathname}?${params.toString()}`);
        }}
      />
    </div>
  );
}
