"use client";

import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";

type ToastTone = "success" | "info" | "warning" | "error";

const TONES: Record<ToastTone, { icon: React.ReactNode; classes: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />,
    classes: "border-emerald-200 bg-emerald-50",
  },
  info: {
    icon: <Info className="h-5 w-5 text-blue-600" aria-hidden="true" />,
    classes: "border-blue-200 bg-blue-50",
  },
  warning: {
    icon: <TriangleAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />,
    classes: "border-amber-200 bg-amber-50",
  },
  error: {
    icon: <XCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />,
    classes: "border-rose-200 bg-rose-50",
  },
};

export interface ToastProps {
  tone?: ToastTone;
  title: string;
  description?: string;
  className?: string;
}

/** Toast notification with icon — pair with your toast host of choice. */
export function Toast({ tone = "info", title, description, className = "" }: ToastProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg ${t.classes} ${className}`}
    >
      {t.icon}
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
      </div>
    </div>
  );
}
