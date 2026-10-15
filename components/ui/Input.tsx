import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, className = "", ...rest }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`h-10 w-full rounded-md border bg-white px-3 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 ${
        invalid ? "border-rose-500 focus-visible:ring-rose-600" : "border-slate-300 hover:border-slate-400 focus-visible:ring-brand-600"
      } ${className}`}
      {...rest}
    />
  ),
);
Input.displayName = "Input";
