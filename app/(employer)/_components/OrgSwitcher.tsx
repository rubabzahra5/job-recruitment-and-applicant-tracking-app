"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Switch between organizations the user belongs to. */
export function OrgSwitcher({ orgs, currentOrgId }: { orgs: { id: string; name: string }[]; currentOrgId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (orgs.length <= 1) return null;

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("org", e.target.value);
    router.push(`/employer?${params.toString()}`);
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Organization</span>
      <select
        value={currentOrgId}
        onChange={onChange}
        aria-label="Switch organization"
        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
