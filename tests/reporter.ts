/**
 * Test report collector. Captures transaction signatures and CU for generating
 * a markdown report. Enable with REPORT=1.
 */

import { Connection, VersionedTransactionResponse } from "@solana/web3.js";

export interface ReportEntry {
  suite: string;
  test: string;
  instruction: string;
  signature: string;
  cuConsumed?: number;
  error?: string;
}

const entries: ReportEntry[] = [];
let connection: Connection | null = null;
let cluster = "localnet";
let reportEnabled = process.env.REPORT === "1";

export function setReportEnabled(enabled: boolean) {
  reportEnabled = enabled;
}

export function initReporter(conn: Connection, cl?: string) {
  connection = conn;
  if (cl) cluster = cl;
}

export function reportTransaction(
  suite: string,
  test: string,
  instruction: string,
  signature: string,
  error?: string
) {
  if (!reportEnabled) return;
  entries.push({
    suite,
    test,
    instruction,
    signature,
    error,
  });
}

export function getEntries(): ReportEntry[] {
  return [...entries];
}

export function clearReport() {
  entries.length = 0;
}

export function explorerUrl(signature: string): string {
  if (cluster === "localnet" || cluster === "localhost") {
    return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http://127.0.0.1:8899`;
  }
  if (cluster === "devnet") {
    return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  }
  return `https://explorer.solana.com/tx/${signature}`;
}

async function fetchCu(sig: string): Promise<number | undefined> {
  if (!connection) return undefined;
  try {
    const tx = await connection.getTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (tx?.meta) {
      return (tx.meta as { computeUnitsConsumed?: number }).computeUnitsConsumed;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export async function enrichEntries(conn?: Connection): Promise<ReportEntry[]> {
  const connToUse = conn ?? connection;
  if (!connToUse) return entries.map((e) => ({ ...e }));

  const enriched: ReportEntry[] = [];
  const orig = connection;
  connection = connToUse;
  for (const e of entries) {
    const cu = await fetchCu(e.signature);
    enriched.push({ ...e, cuConsumed: cu });
  }
  connection = orig;
  return enriched;
}

export async function generateReport(
  outputPath: string,
  testResults: { passed: number; failed: number; pending: number },
  conn?: Connection
): Promise<void> {
  if (!reportEnabled) return;
  if (entries.length === 0) {
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.dirname(outputPath);
    if (dir !== ".") fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      outputPath,
      `# Test Report (no transactions logged)\n\nPassed: ${testResults.passed}, Failed: ${testResults.failed}, Skipped: ${testResults.pending}\n`,
      "utf-8"
    );
    return;
  }

  const enriched = await enrichEntries(conn);

  const timestamp = new Date().toISOString();
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const report = `# Solana Stablecoin Standard — Test Report

**Generated:** ${date} (${timestamp})

## Summary

| Metric | Count |
|--------|-------|
| Tests Passed | ${testResults.passed} |
| Tests Failed | ${testResults.failed} |
| Tests Skipped | ${testResults.pending} |
| Transactions Logged | ${enriched.length} |
| Cluster | ${cluster} |

## Program IDs

| Program | Address |
|---------|---------|
| sss-core | \`CoREsjH41J3KezywbudJC4gHqCE1QhNWaXRbC1QjA9ei\` |
| sss-transfer-hook | \`HooKchDVVKm7GkAX4w75bbaQUbMcDUnYXSzqLZCWKCDH\` |

## Transaction Log (by suite)

${Object.entries(
  enriched.reduce(
    (acc, e) => {
      const key = e.suite;
      if (!acc[key]) acc[key] = [];
      acc[key].push(e);
      return acc;
    },
    {} as Record<string, ReportEntry[]>
  )
)
  .map(
    ([suite, items]) =>
      `### ${suite}\n\n| Test | Instruction | Signature | CU | Explorer |\n|------|-------------|------------|-----|----------|\n${items
        .map(
          (i) =>
            `| ${i.test} | \`${i.instruction}\` | \`${i.signature.slice(0, 20)}...\` | ${i.cuConsumed ?? "—"} | [View](${explorerUrl(i.signature)}) |`
        )
        .join("\n")}\n\n`
  )
  .join("")}

## CU Summary (where available)

| Instruction | Min CU | Max CU | Avg CU |
|-------------|--------|--------|--------|
${Object.entries(
  enriched.reduce(
    (acc, e) => {
      if (e.cuConsumed != null) {
        const key = e.instruction;
        if (!acc[key]) acc[key] = [];
        acc[key].push(e.cuConsumed);
      }
      return acc;
    },
    {} as Record<string, number[]>
  )
)
  .map(([ix, values]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    return `| \`${ix}\` | ${min} | ${max} | ${avg} |`;
  })
  .join("\n")}

---

*Report generated by \`REPORT=1 anchor test\`*
`;

  const fs = await import("fs");
  const path = await import("path");
  const dir = path.dirname(outputPath);
  if (dir !== ".") {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, report, "utf-8");
}
