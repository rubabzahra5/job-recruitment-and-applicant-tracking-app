import * as React from "react";

export interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}

export function Stat({ label, value, hint, className = "" }: StatProps) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 ${className}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
