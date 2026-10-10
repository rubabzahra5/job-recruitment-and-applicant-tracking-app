"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export interface DashboardFilterOptions {
  departments: { id: string; name: string }[];
  jobs: { id: string; title: string }[];
  recruiters: { userId: string; name: string }[];
  stages: { key: string; label: string }[];
}

/** Dashboard filters — updates URL search params (server re-renders). */
export function DashboardFilters({ options }: { options: DashboardFilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const get = (k: string) => searchParams.get(k) ?? "";

  const set = (params: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`/employer?${next.toString()}`);
  };

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(e) => e.preventDefault()}
      aria-label="Dashboard filters"
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        From
        <Input
          type="date"
          value={get("from")}
          onChange={(e) => set({ from: e.target.value })}
          className="w-40"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        To
        <Input
          type="date"
          value={get("to")}
          onChange={(e) => set({ to: e.target.value })}
          className="w-40"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Department
        <Select value={get("dept")} onChange={(e) => set({ dept: e.target.value })} className="w-44">
          <option value="">All departments</option>
          {options.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Vacancy
        <Select value={get("job")} onChange={(e) => set({ job: e.target.value })} className="w-52">
          <option value="">All vacancies</option>
          {options.jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Recruiter
        <Select value={get("recruiter")} onChange={(e) => set({ recruiter: e.target.value })} className="w-44">
          <option value="">All recruiters</option>
          {options.recruiters.map((r) => (
            <option key={r.userId} value={r.userId}>
              {r.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Stage
        <Select value={get("stage")} onChange={(e) => set({ stage: e.target.value })} className="w-44">
          <option value="">All stages</option>
          {options.stages.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
      </label>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          const next = new URLSearchParams();
          const org = searchParams.get("org");
          if (org) next.set("org", org);
          router.push(`/employer?${next.toString()}`);
        }}
      >
        Clear
      </Button>
    </form>
  );
}
