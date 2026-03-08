# CU & Zero-Copy Honest Assessment

**Date:** March 8, 2026  
**Based on:** `reports/test-report-2026-03-08T05-39-39.md` and research

---

## Executive Summary

**Zero-copy:** ✅ sss-core is **correctly** implementing zero-copy for `StablecoinConfig`. The transfer-hook cannot use zero-copy for `BlacklistEntry` due to `String`; the hot path (transfer validation) is already lean.

**CU performance:** Our numbers are **reasonable for a compliance-heavy stablecoin framework**. They are not best-in-class, but they are appropriate for the feature set. There is room for optimization, especially on admin paths (add_to_blacklist, remove_from_blacklist).

---

## 1. Zero-Copy Implementation — Correct or Not?

### sss-core: **Correctly Implemented**

- `StablecoinConfig` uses `#[account(zero_copy(unsafe))]` with `repr(packed)` semantics.
- All 14+ instructions that touch config use `AccountLoader<'info, StablecoinConfig>`.
- Load pattern: `config.load()` / `config.load_mut()` — no full deserialization into heap.

**Verification:**

```
programs/sss-core/src/state/config.rs: #[account(zero_copy(unsafe))]
All sss-core instructions: AccountLoader<'info, StablecoinConfig>
```

### Architecture Claim vs Reality

The Architecture doc states: *"~80–90% CU reduction on reads; competitors use regular Account"*.

**Honest answer:** The 80–90% figure comes from Anchor’s docs for **1KB+** accounts:
- 1 KB account: ~8,000 CU (Account) vs ~1,500 CU (AccountLoader) ≈ 81% reduction.
- 10 KB: ~50,000 vs ~5,000 ≈ 90%.

**Our `StablecoinConfig` size:** ~414 bytes (8 discriminator + struct). For sub-1KB accounts, zero-copy still helps, but the gain is smaller. A ~400-byte account with `Account` might cost ~3–4K CU vs ~1–1.5K with zero-copy.

**Verdict:** Zero-copy is correctly implemented and beneficial. The 80–90% claim is from Anchor’s general guidance; our actual gain is meaningful but not necessarily that high for this struct size. We are correctly using the optimization.

### sss-transfer-hook: **Cannot Use Zero-Copy for BlacklistEntry**

`BlacklistEntry` has:

```rust
pub reason: String,  // variable-length
```

Zero-copy requires fixed-size, `Pod`/`Zeroable` types. `String` is not compatible.

**Options (if we wanted zero-copy):**
- Replace with `[u8; 128]` (fixed buffer) — would be a breaking change and complicates UX.
- `add_to_blacklist` / `remove_from_blacklist` are admin ops, not hot path; optimization impact is limited.

**Hot path:** The `transfer_hook` instruction uses only `UncheckedAccount` and `data_is_empty()`. No deserialization, minimal CU. That path is already optimized.

---

## 2. CU Comparison — Benchmarks vs Expectations

### Reference Points (from research)

| Operation                       | Typical CU        | Source                          |
|--------------------------------|-------------------|---------------------------------|
| Simple SPL transfer            | ~300–4,500        | Solana docs, sol.xyz            |
| CPI base cost                   | ~1,000 (→ 946)    | Solana CPI cost model           |
| Token-2022 MintTo (callee only) | ~5,000–8,000+     | CPI + Token internals           |
| Account creation (init)         | High (rent + CPU) | Creating new account is costly  |

### Our Numbers vs Context

| Instruction                  | Our CU    | Assessment                                                                 |
|-----------------------------|-----------|----------------------------------------------------------------------------|
| `initialize`                | 17–20K    | Create config + mint with Token-2022 extensions. Expected to be heavy.     |
| `mint_tokens`               | 11–13K    | CPI MintTo, config, RoleAccount, optional Pyth. Reasonable.               |
| `burn_tokens`               | ~11K      | Similar to mint. Reasonable.                                              |
| `seize`                     | ~12.7K    | CPI TransferChecked. Reasonable.                                          |
| `initialize_extra_account_metas` | 7.6K  | Create ExtraAccountMetaList. Light; good.                                  |
| `add_to_blacklist`         | ~20K      | **High.** Init (account creation), role verify. Room for improvement.       |
| `remove_from_blacklist`    | ~15K      | Close account, verify. Moderate.                                           |
| `update_transfer_fee`      | ~11K      | Config update. Reasonable.                                                 |

### Verdict: Have We Achieved the Best CU?

**No.** We are not at “best possible” CU. We are within a reasonable range for a compliance-heavy stablecoin framework.

- **Hot paths (mint, burn, seize):** 11–13K is reasonable given CPI + Token-2022 + RBAC checks.
- **Admin paths:** `add_to_blacklist` at ~20K is on the high side; there is room to optimize.
- **Transfer hook (hot path):** No CU from our report; it runs inside Token-2022’s CPI. It only checks `data_is_empty()`, so it should stay cheap.

---

## 3. Practical Improvements (Prioritized)

### High impact

1. **`add_to_blacklist` (20K → lower)**
   - Account creation dominates. Options:
     - Reuse a pool or preallocate if design allows.
     - Reduce `BlacklistEntry` size (e.g. shorter or fixed `reason`).
   - `verify_blacklister_for_mint` loads sss-core `RoleAccount` via CPI. Consider caching or minimizing cross-program reads if possible.

2. **`remove_from_blacklist` (15K)**
   - Ensure we close accounts correctly (e.g. via `close` with correct beneficiary) to avoid unnecessary work.

### Medium impact

3. **`RoleAccount` (mint path)**
   - Currently `Account<'info, RoleAccount>` with `Option<u64>`.
   - Option prevents zero-copy (not `Pod`). Using `u64::MAX` as “no quota” would allow a fixed-size struct and zero-copy if desired.
   - Saves CU on every `mint_tokens`.

4. **Event size**
   - `emit!()` adds CU. Shrink event payloads if they are larger than needed (e.g. avoid large strings or redundant data).

5. **Unnecessary clones**
   - Example: `reason.clone()` in add_to_blacklist before emit. Reuse or move when possible to avoid extra allocations.

### Low impact

6. **`BlacklistEntry` zero-copy**
   - Would require `reason: [u8; 128]` instead of `String`. Improves add/remove a bit, but these are infrequent admin ops.

7. **StablecoinConfig size**
   - Could trim `_reserved`, `uri`, etc. if not needed. Slight CU benefit on config load.

---

## 4. Architecture Zero-Copy Claim — Correct?

| Claim                                      | Reality                                                                 |
|-------------------------------------------|-------------------------------------------------------------------------|
| "Zero-copy deserialization for config"     | ✅ Correct — `StablecoinConfig` uses `AccountLoader` everywhere.        |
| "~80–90% CU reduction on reads"            | ⚠️ Overstated for our size — benefit is real but smaller for ~400B.   |
| "Critical for keeping CU costs low"        | ✅ True — we are using the right pattern for config.                    |

---

## 5. Final Recommendation

- **Zero-copy:** Implementation is correct; keep it.
- **Overall CU:** Reasonable for our feature set; not best-in-class.
- **Next steps:**
  1. Profile `add_to_blacklist` and `remove_from_blacklist` with a profiler (e.g. Solana’s `--config log` or sbf tools).
  2. Consider `RoleAccount` zero-copy if we can replace `Option<u64>` with a sentinel value.
  3. Keep the transfer-hook as-is; it is already minimal for the hot path.

---

*Generated from report `test-report-2026-03-08T05-39-39.md` and public Solana/Anchor CU documentation.*
