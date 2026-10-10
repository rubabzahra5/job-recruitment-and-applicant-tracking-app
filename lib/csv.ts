/**
 * Scoped CSV export helper.
 *
 * - RFC 4180 escaping: fields containing quotes, commas, or newlines are
 *   wrapped in double quotes with inner quotes doubled.
 * - Formula-injection mitigation: cell values starting with =, +, -, or @
 *   (after trimming) are prefixed with a single quote so spreadsheet apps do
 *   not evaluate them. Documented trade-off: the exported text gains a
 *   leading `'` for such cells.
 * - `exportScopedCsv()` enforces a caller-supplied row cap ("scoped": exports
 *   are always bounded and the caller names the scope for audit purposes).
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export interface ScopedExportOptions {
  /** Maximum rows to include — exports are always bounded. */
  maxRows: number;
  /** Human label for the export scope, e.g. "org 123 applications". Used in errors/audit. */
  scope: string;
}

const FORMULA_PREFIX = /^[=+\-@]/;

function escapeCell(raw: unknown): string {
  let text =
    raw === null || raw === undefined
      ? ""
      : raw instanceof Date
        ? raw.toISOString()
        : String(raw);
  text = text.trimStart();
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/["\n\r,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Render rows to a CSV string with proper escaping. */
export function toCSV<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(","),
  );
  return [header, ...lines].join("\r\n");
}

/**
 * Bounded CSV export. Throws when rows exceed maxRows so callers must
 * paginate/scope instead of dumping unbounded data.
 */
export function exportScopedCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  options: ScopedExportOptions,
): string {
  if (rows.length > options.maxRows) {
    throw new Error(
      `Export scope "${options.scope}" exceeds the ${options.maxRows}-row limit ` +
        `(${rows.length} rows). Narrow the filters and retry.`,
    );
  }
  return toCSV(rows, columns);
}
