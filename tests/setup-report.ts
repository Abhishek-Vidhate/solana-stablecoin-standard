/**
 * Setup for test reporting. Enable via REPORT=1 or presence of .report-requested.
 * Patches Mocha to generate a report after tests complete.
 */

import * as path from "path";
import * as fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const REPORT_ENABLED =
  process.env.REPORT === "1" ||
  fs.existsSync(path.join(process.cwd(), ".report-requested"));

function patchMocha() {
  // Resolve from cwd to patch the CLI's Mocha, not tests/node_modules/mocha
  const Mocha = require(require.resolve("mocha", { paths: [process.cwd()] }));
  const originalRun = Mocha.prototype.run;

  Mocha.prototype.run = function (fn?: (failures: number) => void) {
    const originalFn = fn;
    const wrappedFn =
      REPORT_ENABLED && typeof originalFn === "function"
        ? (failures: number) => {
            generateReportAsync(runner!)
              .then(() => originalFn!(failures))
              .catch((err) => {
                console.error("Report generation failed:", err);
                originalFn!(failures);
              });
          }
        : originalFn;
    const runner = originalRun.call(this, wrappedFn);
    return runner;
  };
}

async function generateReportAsync(runner: { stats?: { passes?: number; failures?: number; pending?: number } }) {
  const { generateReport, getEntries } = require("./reporter");
  const stats = runner.stats ?? {};

  // Connection may be set by tests via initReporter - if not, we'll fetch without CU
  const baseDir = process.cwd();
  const outputDir = path.join(baseDir, "reports");
  const outputPath = path.join(outputDir, `test-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`);

  await generateReport(
    outputPath,
    {
      passed: stats.passes ?? 0,
      failed: stats.failures ?? 0,
      pending: stats.pending ?? 0,
    },
    undefined // connection from initReporter
  );

  console.log(`\n📄 Test report: ${path.resolve(outputPath)} (${getEntries().length} txs)`);
  const flagPath = path.join(baseDir, ".report-requested");
  if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
}

if (REPORT_ENABLED) {
  require("./reporter").setReportEnabled(true);
  patchMocha();
}
