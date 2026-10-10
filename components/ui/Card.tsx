import * as React from "react";

export function Card({ className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}
      {...rest}
    />
  );
}

export function CardHeader({ className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`border-b border-slate-100 px-5 py-4 ${className}`} {...rest} />;
}

export function CardTitle({ className = "", ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-base font-semibold ${className}`} {...rest} />;
}

export function CardContent({ className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-5 py-4 ${className}`} {...rest} />;
}

export function CardFooter({ className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 ${className}`} {...rest} />
  );
}
