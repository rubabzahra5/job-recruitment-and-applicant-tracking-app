import * as React from "react";

export interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}

export function Stat({ label, value, hint, className = "" }: StatProps) {
  return (
    <div className={`card-lift reveal relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 to-teal-400"
      />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{hint}</p>}
    </div>
  );
}
