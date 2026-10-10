import Link from "next/link";

export interface PagerProps {
  page: number;
  totalPages: number;
  /** Base path, e.g. "/jobs". */
  basePath: string;
  /** Current query params to preserve (without `page`). */
  params: Record<string, string>;
}

function pageItems(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages]);
  const sorted = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const items: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) items.push("…");
    items.push(n);
  }
  return items;
}

function href(basePath: string, params: Record<string, string>, page: number): string {
  const sp = new URLSearchParams(params);
  if (page <= 1) sp.delete("page");
  else sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Server-rendered pagination with shareable links — every page of results
 * keeps the active filters in the URL.
 */
export function Pager({ page, totalPages, basePath, params }: PagerProps) {
  if (totalPages <= 1) return null;
  const btn =
    "inline-flex min-w-9 items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm hover:bg-slate-50";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(basePath, params, page - 1)} className={btn} aria-label="Go to previous page">
          ‹
        </Link>
      ) : (
        <span aria-hidden="true" className={`${btn} cursor-not-allowed opacity-50`}>‹</span>
      )}
      {pageItems(page, totalPages).map((item, i) =>
        item === "…" ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={href(basePath, params, item)}
            aria-label={`Go to page ${item}`}
            aria-current={item === page ? "page" : undefined}
            className={`${btn} ${item === page ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700" : ""}`}
          >
            {item}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={href(basePath, params, page + 1)} className={btn} aria-label="Go to next page">
          ›
        </Link>
      ) : (
        <span aria-hidden="true" className={`${btn} cursor-not-allowed opacity-50`}>›</span>
      )}
    </nav>
  );
}
