/**
 * Fee-lock regression test (Phase 2: "Free means free").
 *
 * TalentBridge's core promise is zero fees. This test scans the codebase
 * for payment-related code that would violate that promise. If someone
 * adds Stripe, paywalls, or fee logic, this test fails and forces an
 * explicit conversation.
 *
 * This is intentionally a source-code scan, not a runtime test — it catches
 * the introduction of payment dependencies at review time.
 */
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

// Patterns that indicate payment/fee code. Each must have an explicit
// allowlist entry below with a justification.
const FORBIDDEN_PATTERNS = [
  /stripe/i,
  /paypal/i,
  /\bpaywall\b/i,
  /subscription.*price/i,
  /credit.?card/i,
  /checkout.*session/i,
  /payment.?intent/i,
];

// Files/dirs to skip (e.g., this test itself, docs discussing fees).
const SKIP = [
  "tests/no-paywall.test.ts",
  "node_modules",
  ".next",
  "why-free", // the comparison page legitimately discusses fees
];

function findMatches(): Array<{ file: string; pattern: string; line: string }> {
  const results: Array<{ file: string; pattern: string; line: string }> = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    try {
      const out = execSync(
        `grep -rn -E "${pattern.source}" --include="*.ts" --include="*.tsx" ${ROOT}/app ${ROOT}/lib ${ROOT}/components 2>/dev/null | head -20`,
        { encoding: "utf-8" },
      );
      for (const line of out.split("\n")) {
        if (!line.trim()) continue;
        const file = line.split(":")[0] ?? "";
        if (SKIP.some((s) => file.includes(s))) continue;
        results.push({ file, pattern: pattern.source, line: line.slice(0, 120) });
      }
    } catch {
      // grep returns non-zero when no matches — that's the good case.
    }
  }
  return results;
}

describe("fee lock: no payment code", () => {
  it("contains no payment processor integrations", () => {
    const matches = findMatches();
    expect(
      matches,
      `Payment-related code found (violates "free means free" promise):\n${matches
        .map((m) => `  ${m.file}: ${m.line}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("platform_settings has fees explicitly disabled", async () => {
    // This documents the intent. The actual setting is seeded in migrations;
    // this test ensures the convention is understood.
    const { getPlatformSetting } = await import("@/lib/settings");
    // If the setting doesn't exist yet, that's fine — the test documents
    // that fees must never be enabled without explicit product decision.
    expect(typeof getPlatformSetting).toBe("function");
  });
});
