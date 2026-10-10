import * as React from "react";

type Tone = "info" | "success" | "warning" | "error";

const tones: Record<Tone, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  title?: string;
}

export function Alert({ tone = "info", title, className = "", children, ...rest }: AlertProps) {
  return (
    <div
      role="alert"
      className={`rounded-md border px-4 py-3 text-sm ${tones[tone]} ${className}`}
      {...rest}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}
