import * as React from "react";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = "Loading…", className = "" }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-3 py-12 ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
      />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
