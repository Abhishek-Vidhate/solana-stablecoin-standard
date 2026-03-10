# Honest Assessment: Trident Tests

## Summary

**Short answer:** The Trident fuzz tests in `fuzz_0/` are **real** Trident tests (not stubs). They use `trident-fuzz`, process transactions via TridentSVM against actual BPF programs. However, there are important caveats.

---

## 1. Location

✅ **Yes, `trident-tests` is in the project root.**  
Path: `solana-stablecoin-standard/trident-tests/`

---

## 2. What Is Real vs What Is Not

### Real Trident fuzz tests (`fuzz_0/test_fuzz.rs`)

- Uses `trident-fuzz` 0.12.0 with proper Trident macros: `#[flow_executor]`, `#[init]`, `#[flow]`, `#[end]`
- Calls `self.trident.process_transaction()` → runs against **TridentSVM** (real Solana execution)
- `Trident.toml` loads actual `.so` programs: `sss_core.so`, `sss_transfer_hook.so`
- Flow sequences (initialize, mint, pause, role management, etc.) build real transactions and execute them on the SVM
- Invariant check in `#[end]` reads actual account data from the SVM

These are **real** Trident fuzz tests and satisfy the “Trident test must be real” requirement.

### Proptest tests (`src/arithmetic.rs`, `src/supply_cap.rs`, etc.)

- Use **proptest** on a local Rust struct `SimConfig`
- `SimConfig` is a simulation mirror of `StablecoinConfig` (on-chain state)
- They do **not** call `process_transaction` or the Trident API
- They do **not** run any Solana program; they only test off-chain simulation logic

They are supplementary property-based tests of the simulation model, **not** Trident tests.

---

## 3. Current Build Status

❌ **The Trident tests do not currently build.**

```
error: failed to select a version for `solana-transaction-context`.
  trident-svm requires =2.3.1
  trident-fuzz's solana-sdk ^2.3 pulls 2.3.0
```

This matches the known version conflict described in `trident-tests/README.md`. Until resolved, neither the fuzz binary nor the proptest tests can run.

---

## 4. Token-2022 Compatibility

Trident has an open bug: **[#385 – Trident doesn't support Token2022 ATAs](https://github.com/Ackee-Blockchain/trident/issues/385).**

- `sss_core` uses Token-2022 for minting
- `mint_tokens` CPIs to `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`
- Even after fixing the build, `flow_mint_tokens` may fail if Trident does not correctly set up Token-2022 mint/ATA accounts

---

## 5. Verdict for Bounty

| Requirement                 | Status                                             |
|----------------------------|----------------------------------------------------|
| Trident tests must be real | ✅ `fuzz_0/` uses real Trident + TridentSVM       |
| Not fake/stub              | ✅ No mocks; real BPF programs and transactions   |
| Proptest                   | ⚠️ `src/` uses proptest on SimConfig (not Trident)|
| Runnable                   | ❌ Build fails due to dependency conflict          |
| Token-2022                 | ⚠️ Known Trident limitation                       |

---

## 6. Recommendations

1. **Fix the build** – Add a `[patch.crates-io]` or workspace override for `solana-transaction-context` (and optionally `bytemuck_derive`).
2. **Clarify scope** – The bounty “Trident test must be real” is satisfied by `fuzz_0/`. The proptest tests in `src/` are extra coverage and should not be presented as Trident tests.
3. **Token-2022** – Watch Trident issue #385 or consider testing flows that don’t depend on Token-2022 ATA setup until support lands.
