import * as React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid = false, className = "", children, ...rest }, ref) => (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`h-10 w-full appearance-none rounded-md border bg-white px-3 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 ${
        invalid ? "border-red-500" : "border-slate-300"
      } ${className}`}
      {...rest}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
