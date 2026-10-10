import { describe, expect, it } from "vitest";
import { exportScopedCsv, toCSV, type CsvColumn } from "@/lib/csv";
import { formatPKR, formatSalaryRange } from "@/lib/format";

/** PKR grouping (Pakistani/Indian-style) + CSV escaping — task-specified cases. */

describe("formatPKR — Pakistani digit grouping", () => {
  it("groups thousands as Rs 85,000", () => {
    expect(formatPKR(85000)).toBe("Rs 85,000");
  });

  it("groups lakhs as Rs 15,00,000", () => {
    expect(formatPKR(1500000)).toBe("Rs 15,00,000");
  });

  it("groups crores as Rs 1,00,00,000", () => {
    expect(formatPKR(10000000)).toBe("Rs 1,00,00,000");
  });

  it("leaves sub-thousand amounts ungrouped", () => {
    expect(formatPKR(500)).toBe("Rs 500");
  });

  it("handles negatives, strings, and missing values", () => {
    expect(formatPKR(-2500)).toBe("Rs -2,500");
    expect(formatPKR("75000")).toBe("Rs 75,000");
    expect(formatPKR(null)).toBe("—");
    expect(formatPKR(undefined)).toBe("—");
    expect(formatPKR("")).toBe("—");
    expect(formatPKR(Number.NaN)).toBe("—");
  });

  it("rounds fractional amounts", () => {
    expect(formatPKR(99999.6)).toBe("Rs 1,00,000");
  });
});

describe("formatSalaryRange", () => {
  it("renders both ends with the period", () => {
    expect(formatSalaryRange(80000, 120000)).toBe("Rs 80,000 – Rs 1,20,000 / month");
  });

  it("renders open-ended ranges", () => {
    expect(formatSalaryRange(80000, null)).toBe("Rs 80,000 / month");
    expect(formatSalaryRange(null, 120000)).toBe("Rs 1,20,000 / month");
  });

  it("says Not disclosed when both ends are missing", () => {
    expect(formatSalaryRange(null, null)).toBe("Not disclosed");
    expect(formatSalaryRange(undefined, undefined)).toBe("Not disclosed");
  });

  it("labels annual and hourly periods", () => {
    expect(formatSalaryRange(1800000, 2400000, "annual")).toBe(
      "Rs 18,00,000 – Rs 24,00,000 / year",
    );
    expect(formatSalaryRange(1500, 2500, "hourly")).toBe("Rs 1,500 – Rs 2,500 / hour");
  });
});

interface Row {
  name: string;
  note: string;
}
const cols: CsvColumn<Row>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Note", value: (r) => r.note },
];

describe("toCSV — RFC 4180 escaping", () => {
  it("doubles embedded quotes", () => {
    const out = toCSV([{ name: 'Ali "The Dev" Raza', note: "x" }], cols);
    expect(out).toContain('"Ali ""The Dev"" Raza"');
  });

  it("quotes fields containing commas or newlines", () => {
    const out = toCSV([{ name: "Lahore, Punjab", note: "line1\nline2" }], cols);
    expect(out).toContain('"Lahore, Punjab"');
    expect(out).toContain('"line1\nline2"');
  });

  it("uses CRLF line endings", () => {
    const out = toCSV(
      [
        { name: "a", note: "b" },
        { name: "c", note: "d" },
      ],
      cols,
    );
    expect(out).toBe("Name,Note\r\na,b\r\nc,d");
  });
});

describe("toCSV — formula-injection neutralization", () => {
  it("prefixes cells starting with =, +, -, @", () => {
    const out = toCSV(
      [{ name: "=SUM(A1:A2)", note: "+12345" }],
      cols,
    );
    expect(out).toContain("'=SUM(A1:A2)");
    expect(out).toContain("'+12345");
  });

  it("neutralizes after trimming leading whitespace", () => {
    const out = toCSV([{ name: "  @malicious", note: "ok" }], cols);
    expect(out).toContain("'@malicious");
  });

  it("leaves ordinary text untouched", () => {
    const out = toCSV([{ name: "Rs 85,000", note: "Applied" }], cols);
    expect(out).not.toContain("'");
  });
});

describe("exportScopedCsv — bounded exports", () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ name: `n${i}`, note: "" }));

  it("throws when rows exceed maxRows, naming the scope", () => {
    expect(() =>
      exportScopedCsv(rows, cols, { maxRows: 2, scope: "org-1 applications" }),
    ).toThrow(/org-1 applications/);
  });

  it("exports exactly at the limit", () => {
    const out = exportScopedCsv(rows, cols, { maxRows: 5, scope: "test" });
    expect(out.split("\r\n")).toHaveLength(6); // header + 5 rows
  });
});
