"use client";

import * as React from "react";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wires label + hint + error to a form control via ids.
 * The child control must accept `id`, `aria-describedby` and `aria-invalid`;
 * pass `invalid={!!error}` on Input/Textarea/Select.
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  className = "",
}: FormFieldProps) {
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;

  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: htmlFor,
        "aria-describedby": [hint ? hintId : null, error ? errorId : null]
          .filter(Boolean)
          .join(" ") || undefined,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {child}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
