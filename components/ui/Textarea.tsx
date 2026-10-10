import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid = false, className = "", ...rest }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`min-h-[96px] w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 ${
        invalid ? "border-red-500" : "border-slate-300"
      } ${className}`}
      {...rest}
    />
  ),
);
Textarea.displayName = "Textarea";
