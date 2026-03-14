# Trident and Token-2022: Honest Assessment

This document provides a clear, factual assessment of using [Trident](https://ackee.xyz/trident/) (the Solana fuzzing framework) with Token-2022 programs, specifically in the context of the Solana Stablecoin Standard (SSS).

## Executive Summary

The SSS uses **Token-2022 exclusively** for all stablecoin mints. Trident is the recommended fuzzing framework for Solana programs, but as of March 2026, integration with Token-2022 is **not production-ready** for SSS. This document explains why and what alternatives exist.

---

## Trident Overview

Trident is a manually-guided fuzzing framework for Solana programs:

- **Manually-guided fuzzing (MGF):** Targets specific attack vectors and edge cases
- **TridentSVM:** Runs against actual BPF programs
- **Flow-based testing:** `#[init]`, `#[flow]`, `#[end]` macros for transaction sequences
- **High throughput:** Up to ~12,000 tx/s in fuzz runs

For more, see the [Trident documentation](https://ackee.xyz/trident/docs/latest/trident-api/).

---

## Honest Assessment: Trident Issue #385

The primary blocker for implementing Trident fuzz testing in SSS was [Trident Issue #385](https://github.com/ackee-blockchain/trident/issues/385), which documents a critical incompatibility with Token-2022 Associated Token Accounts (ATAs).

### The "incorrect program id" Error
When running SSS instructions in the Trident SVM environment, any call that interacts with a Token-2022 ATA fails with:
`incorrect program id for instruction at GetAccountDataSize`

### Technical Root Cause
The Associated Token Account (ATA) program CPI within the Trident environment uses the **legacy SPL Token instruction encoding** even when the instruction is targeted at the Token-2022 program ID (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`).

Because Token-2022 strictly validates instruction format, it rejects the legacy-encoded `GetAccountDataSize` call as an invalid program ID mismatch.

### Impact on SSS Fuzzing
Since the SSS architecture is built entirely on Token-2022, every core instruction (`mint_tokens`, `burn_tokens`, `seize`) requires interaction with Token-2022 ATAs. This bug effectively bricked the fuzzing environment for our programs, making meaningful stateful testing unfeasible until the framework-level fix was broadly released.

**Impact on SSS:**
- SSS programs CPI to Token-2022 for `MintTo`, which may create recipient ATAs
- Any Trident flow that exercises `mint_tokens` will hit this when the recipient ATA does not exist
- Creating Token-2022 ATAs in Trident flows fails until this is fixed

### Status

- **State:** Open (as of last check)
- **Maintainer note:** "The whole support for token, token 2022 program and creating associated token accounts will be much smoother in next release!" (Oct 2025)
- **Workaround:** None that reliably exercises SSS mint flows with Token-2022 ATAs

---

## Dependency Conflict (Historical)

When Trident was integrated into SSS, a version conflict existed:

- `trident-svm` requires `solana-transaction-context = 2.3.1`
- `trident-fuzz`’s `solana-sdk ^2.3` pulls `2.3.0`

This could be worked around with `[patch.crates-io]`, but combined with the Token-2022 ATA limitation, running meaningful Trident tests against SSS was not feasible. For that reason, Trident tests were removed from the SSS repository.

---

## Alternatives Used by SSS

SSS relies on the following for correctness and coverage:

| Approach | Purpose |
|----------|---------|
| **Anchor integration tests** | Full end-to-end flows on localnet (LiteSVM) for all presets |
| **SDK unit tests** | PDA derivation, error mapping, preset creation |
| **TypeScript ts-mocha tests** | Integration with programs, role checks, compliance flows |

These cover the critical paths without requiring Trident.

---

## Recommendations

1. **Re-evaluate Trident** when Trident Issue #385 is resolved and Token-2022 ATA creation works.
2. **Until then:** Use Anchor integration tests and SDK tests as the primary test surface.
3. **If Trident is required by a bounty/audit:** Document this limitation and the plan to add Trident tests once the framework supports Token-2022 ATAs.

---

## References

- [Trident GitHub](https://github.com/Ackee-Blockchain/trident)
- [Trident Issue #385: Token2022 ATAs](https://github.com/Ackee-Blockchain/trident/issues/385)
- [Trident Token-2022 Methods (Docs)](https://ackee.xyz/trident/docs/dev/trident-api/token-2022/)
