# Test Report Generation

Generate a markdown report with transaction signatures, compute units (CU), and Solana Explorer links from the integration test run.

## Usage

```bash
npm run test:report
```

This runs `anchor test` with `REPORT=1`, which:

1. Runs all integration tests as usual
2. Collects transaction signatures from tests that call `reportTx()`
3. Fetches compute units consumed for each transaction
4. Writes `reports/test-report-<timestamp>.md` after tests complete

## Report Contents

- **Summary:** Tests passed/failed/skipped, transaction count, cluster
- **Program IDs:** sss-core and sss-transfer-hook addresses
- **Transaction log:** Per-suite table with test name, instruction, signature (truncated), CU, Explorer link
- **CU summary:** Min/Max/Avg CU per instruction type

## Explorer Links

- **Localnet:** `https://explorer.solana.com/tx/{sig}?cluster=custom&customUrl=http://127.0.0.1:8899`
- **Devnet:** `https://explorer.solana.com/tx/{sig}?cluster=devnet`
- **Mainnet:** `https://explorer.solana.com/tx/{sig}`

Set `cluster` via `initReportConnection(connection, "devnet")` when running on devnet.

## Adding More Transactions to the Report

In test files, after any RPC call that returns a signature:

```ts
import { initReportConnection, reportTx } from "./helpers";

// In before():
initReportConnection(connection);

// After .rpc():
const sig = await coreProgram.methods.someInstruction(...).rpc();
reportTx("Suite Name", "test description", "instruction_name", sig);
```

The report only includes transactions from tests that call `reportTx()`.
