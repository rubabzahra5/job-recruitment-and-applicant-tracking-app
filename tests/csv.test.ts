import { describe, expect, it } from "vitest";
import { exportScopedCsv, toCSV } from "@/lib/csv";

const columns = [
  { header: "Name", value: (r: { name: string }) => r.name },
  { header: "Note", value: (r: { note: string }) => r.note },
];

describe("toCSV", () => {
  it("renders a header and rows", () => {
    const out = toCSV([{ name: "Ali", note: "hi" }], columns);
    expect(out).toBe("Name,Note\r\nAli,hi");
  });

  it("escapes quotes, commas and newlines per RFC 4180", () => {
    const out = toCSV([{ name: 'Saeed "The Dev"', note: "a,b\nc" }], columns);
    expect(out).toBe('Name,Note\r\n"Saeed ""The Dev""","a,b\nc"');
  });

  it("neutralizes formula injection with a leading single quote", () => {
    const out = toCSV([{ name: "=cmd|'/c calc'!A0", note: "+123" }], columns);
    expect(out).toBe("Name,Note\r\n'=cmd|'/c calc'!A0,'+123");
  });

  it("renders null/undefined as empty cells", () => {
    const out = toCSV([{ name: null as unknown as string, note: undefined as unknown as string }], columns);
    expect(out).toBe("Name,Note\r\n,");
  });
});

describe("exportScopedCsv", () => {
  it("exports within the row cap", () => {
    const rows = [{ name: "Ali", note: "x" }];
    expect(exportScopedCsv(rows, columns, { maxRows: 10, scope: "test" })).toContain("Ali");
  });

  it("throws when the row cap is exceeded", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ name: `n${i}`, note: "" }));
    expect(() =>
      exportScopedCsv(rows, columns, { maxRows: 10, scope: "test-scope" }),
    ).toThrow(/test-scope.*10-row limit/);
  });
});
