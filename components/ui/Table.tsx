import * as React from "react";

export function Table({ className = "", ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className={`w-full border-collapse text-left text-sm ${className}`} {...rest} />
    </div>
  );
}

export function TableHead({ className = "", ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-slate-50 ${className}`} {...rest} />;
}

export function TableBody({ className = "", ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-slate-100 ${className}`} {...rest} />;
}

export function TableRow({ className = "", ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`hover:bg-slate-50/60 ${className}`} {...rest} />;
}

export function TableHeaderCell({
  className = "",
  scope = "col",
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
      {...rest}
    />
  );
}

export function TableCell({ className = "", ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 align-top ${className}`} {...rest} />;
}
