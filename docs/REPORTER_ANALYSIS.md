# Test Reporter — Honest Analysis

## Executive Summary

**Guarantee: No.** The reporter does **NOT** include all test transactions. Only **SSS-1** has `reportTx()` calls. SSS-2, SSS-3, SSS-4, Oracle, Roles, and Security tests are **not** instrumented.

**Trident:** Trident tests are **NOT** included and **cannot** be included with the current reporter (it is TypeScript/Mocha-only).

---

## What IS Included in the Report Today

| Suite | File | reportTx Calls | Instructions Logged |
|-------|------|----------------|---------------------|
| **SSS-1** | `tests/sss-1.test.ts` | ✅ 4 | `initialize`, `mint_tokens`, `burn_tokens`, `seize` |
| **SSS-2** | `tests/sss-2.test.ts` | ✅ 6 | `initialize`, `initialize_extra_account_metas`, `mint_tokens`, `add_to_blacklist`, `remove_from_blacklist` |
| **SSS-3** | `tests/sss-3.test.ts` | ✅ 2 | `initialize`, `mint_tokens` |
| **SSS-4** | `tests/sss-4.test.ts` | ✅ 6 | `initialize`, `initialize_extra_account_metas`, `mint_tokens`, `update_transfer_fee`, `withdraw_withheld` |
| Oracle | `tests/oracle.test.ts` | ❌ None | — |
| Role Management | `tests/roles.test.ts` | ❌ None | — |
| Security | `tests/security.test.ts` | ❌ None | — |

**Total:** 18 transactions from SSS-1, SSS-2, SSS-3, SSS-4.

---

## What IS NOT Included (Mocha Tests — Can Be Added)

These TypeScript tests run with `anchor test` but have no `reportTx()`:

| Suite | Key Instructions Not Logged |
|-------|-----------------------------|
| **SSS-2** | `initialize`, `initialize_extra_account_metas`, `thaw_account`, `mint_tokens`, `add_to_blacklist`, `remove_from_blacklist`, `seize` |
| **SSS-3** | `initialize`, `mint_tokens` |
| **SSS-4** | `initialize`, `initialize_extra_account_metas`, `thaw_account`, `mint_tokens`, `update_transfer_fee`, `withdraw_withheld` |
| **Oracle** | `initialize` (with oracle_feed_id), `mint_tokens` (rejected) |
| **Roles** | `initialize`, `grant_role` (multiple), `revoke_role` |
| **Security** | `initialize`, `mint_tokens`, `burn_tokens`, `freeze_account`, `thaw_account`, `pause`, `unpause`, `grant_role`, `revoke_role`, `propose_authority`, `accept_authority` |

Adding `initReportConnection(connection)` and `reportTx(...)` to each suite would include these.

---

## Trident Tests — NOT Included, Different System

### How Trident Works

| Aspect | Mocha/Anchor Tests | Trident Tests |
|--------|--------------------|---------------|
| **Language** | TypeScript | Rust |
| **Runner** | `anchor test` → `npx mocha` | `cargo test` or `trident test` |
| **Runtime** | Real Solana validator (localnet) | Trident SVM (in-process simulator) |
| **Transactions** | Real RPC, real signatures | Simulated, no RPC URL |
| **Location** | `tests/*.test.ts` | `trident-tests/` |

### Can Trident Be Included?

**Short answer: Not with the current reporter.**

Reasons:

1. **Different process** — `anchor test` runs only `tests/*.test.ts`. Trident runs via `cargo test` in `trident-tests/`. They never run in the same process.
2. **No RPC/signatures** — Trident uses `trident-svm`, an in-process simulator. There are no real transaction signatures or Solana Explorer links. Compute units come from Trident’s own metrics.
3. **Different reporting** — `Trident.toml` has `[fuzz.metrics] enabled = true`, so Trident writes its own metrics (e.g. CU, coverage), but not into our `reports/` format.

### What Would Be Needed to Include Trident

- A separate Rust-based reporter that:
  - Hooks into Trident’s `process_transaction` or metrics APIs
  - Writes a JSON/markdown file (e.g. `reports/trident-report-*.md`) with:
    - Test names, instruction names
    - Simulated CU (from Trident metrics)
    - No Explorer links (simulator only)
- Or a combined script that:
  1. Runs `anchor test` → generates `reports/test-report-*.md`
  2. Runs `cargo test -p trident-tests` → generates `reports/trident-report-*.md`
  3. Optionally merges them into one report

This is extra engineering; it is not done today.

---

## Commands to Run Tests and Reports

### Mocha/Anchor Tests (TypeScript)

```bash
# Run all integration tests (no report)
anchor test

# Run all integration tests and generate report (REPORT=1)
npm run test:report
# or
REPORT=1 anchor test
```

### Prerequisites

```bash
# Ensure validator port is free
pkill -f solana-test-validator
# Wait a few seconds, then run tests
```

### Trident Tests (Rust — Separate)

```bash
# Build programs first
anchor build

# Run Trident fuzz / invariant tests
cargo test -p trident-tests
# or, if you use Trident CLI
trident test
```

Trident output goes to its own metrics/logs, not to `reports/`.

---

## Summary: What You Have vs What You Want

| Want | Status |
|------|--------|
| SSS-1 in report | ✅ Done (4 txs) |
| SSS-2 in report | ❌ Need to add `reportTx` to sss-2.test.ts |
| SSS-3 in report | ❌ Need to add `reportTx` to sss-3.test.ts |
| SSS-4 in report | ❌ Need to add `reportTx` to sss-4.test.ts |
| Oracle in report | ❌ Need to add `reportTx` to oracle.test.ts |
| Roles in report | ❌ Need to add `reportTx` to roles.test.ts |
| Security in report | ❌ Need to add `reportTx` to security.test.ts |
| Trident in report | ❌ Not possible with current reporter; would need a separate Rust reporter |
