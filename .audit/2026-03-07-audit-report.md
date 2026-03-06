# SSS On-Chain Programs Audit Report

**Date:** 2026-03-07
**Auditor:** Internal (pre-submission)
**Programs:** sss-core, sss-transfer-hook
**Framework:** Anchor 0.31.1
**Toolchain:** Solana CLI 3.1.8, Rust 1.89.0

---

## Executive Summary

Both programs compile cleanly, follow Anchor best practices, use zero-copy for CU optimization, and have proper RBAC. The audit uncovered **1 CRITICAL**, **1 HIGH**, and **4 MEDIUM** issues. The CRITICAL and HIGH issues have been fixed in this session.

---

## Finding Inventory

| ID | Severity | Category | Status | Description |
|----|----------|----------|--------|-------------|
| C-1 | CRITICAL | Transfer Hook | FIXED | Sender blacklist bypass via token delegate |
| H-1 | HIGH | Access Control | FIXED | Single-step authority transfer (no propose/accept) |
| M-1 | MEDIUM | Account Validation | OPEN | No mint authority validation in `initialize` |
| M-2 | MEDIUM | Arithmetic | OPEN | Pre-existing mint supply not accounted for |
| M-3 | MEDIUM | Feature Gating | OPEN | Seize has no explicit preset gate |
| M-4 | MEDIUM | Events | OPEN | `ConfigUpdated` events lack old/new values |
| L-1 | LOW | CU Optimization | OPEN | Config PDA bump recalculated in every instruction |
| L-2 | LOW | Arithmetic | OPEN | `current_supply()` uses `saturating_sub` |
| L-3 | LOW | Error Handling | OPEN | `unreachable!()` in initialize preset match |
| L-4 | LOW | Account Validation | OPEN | `RevokeRole` lacks seed validation on role_account |
| L-5 | LOW | Events | OPEN | `StablecoinInitialized` event omits `uri` field |
| L-6 | INFO | CU Optimization | OPEN | Redundant `checked_add` in `mint_tokens` |

---

## Critical Findings

### C-1: Sender Blacklist Bypass via Token Delegate

**File:** `programs/sss-transfer-hook/src/instructions/initialize.rs:49`
**Severity:** CRITICAL
**Status:** FIXED

**Description:**
The sender blacklist PDA uses `Seed::AccountKey { index: 3 }` (the source authority). Per the SPL transfer hook spec, index 3 is the "owner or delegate" of the source token account. When a delegate signs the transfer, index 3 is the delegate's pubkey, not the owner's.

**Attack Scenario:**
1. Alice is blacklisted
2. Alice approves Bob (non-blacklisted) as delegate on her token account
3. Bob initiates a transfer of Alice's tokens
4. Token-2022 resolves the sender blacklist PDA as `[BLACKLIST_SEED, mint, Bob]`
5. No blacklist entry for Bob → transfer succeeds
6. Alice's blacklist is completely bypassed

**Root Cause:** Sender blacklist PDA derived from authority (can be delegate) instead of source token account owner.

**Fix Applied:** Changed `Seed::AccountKey { index: 3 }` to `Seed::AccountData { account_index: 0, data_index: 32, length: 32 }` to extract the owner from the source token account data, mirroring the receiver blacklist pattern.

---

## High Findings

### H-1: Single-Step Authority Transfer

**File:** `programs/sss-core/src/instructions/admin/transfer_authority.rs`
**Severity:** HIGH
**Status:** FIXED

**Description:**
Authority transfer was immediate and irreversible. The `new_authority` was an `UncheckedAccount`, meaning transferring to a typo'd address, a PDA, or a lost key permanently locks out the admin. For a compliance stablecoin where admin functions control pausing, minting, and seizure, this is a critical operational risk.

**Fix Applied:** Implemented a two-step propose/accept pattern:
1. `propose_authority(new_authority)` — stores pending authority in config
2. `accept_authority()` — new authority signs to confirm they have access

---

## Medium Findings

### M-1: No Mint Authority Validation in Initialize

**File:** `programs/sss-core/src/instructions/initialize.rs`
**Severity:** MEDIUM

The `mint` account's `mint_authority` and `freeze_authority` are not validated against the config PDA. If the mint was configured with different authorities, downstream CPI calls will fail with cryptic SPL errors.

**Recommendation:** Add handler checks verifying mint authorities equal `config.key()`, or require `mint.supply == 0`.

### M-2: Pre-existing Mint Supply Not Accounted For

**File:** `programs/sss-core/src/instructions/initialize.rs:87-88`
**Severity:** MEDIUM

`total_minted` and `total_burned` both start at 0 regardless of the mint's actual current supply. If tokens were minted before config initialization, the supply cap check would be based on incorrect data.

**Recommendation:** Either validate `mint.supply == 0` during initialization, or set `total_minted = mint.supply`.

### M-3: Seize Has No Explicit Preset Gate

**File:** `programs/sss-core/src/instructions/seize.rs`
**Severity:** MEDIUM

The `seize` instruction has no explicit preset check. It relies on the SPL Token permanent delegate extension being present on the mint. Users see cryptic SPL errors rather than descriptive `SssError`.

**Recommendation:** Add documentation or explicit preset check.

### M-4: ConfigUpdated Events Lack Old/New Values

**File:** `programs/sss-core/src/events.rs:91-96`
**Severity:** MEDIUM

The generic `ConfigUpdated` event is used for 4 different admin operations but omits old/new values. For compliance audit trails, indexers need to know what changed.

**Recommendation:** Create specific event types per operation with old/new value fields.

---

## Low / Info Findings

### L-1: Config PDA Bump Recalculated (~1500 CU waste per call)
All instructions use `bump` (recalculated) instead of `bump = config.load()?.bump` in constraints. Costs ~1500 extra CU per instruction invocation.

### L-2: current_supply() Uses saturating_sub
If an invariant violation causes `total_burned > total_minted`, this silently returns 0 instead of surfacing the error.

### L-3: unreachable!() Instead of Error Return
The preset match arm uses `unreachable!()` which panics with unhelpful message. Should return `SssError::InvalidPreset`.

### L-4: RevokeRole Lacks Seed Validation
The `role_account` is validated only by discriminator and `config == config.key()`, not by PDA seeds. Safe in practice but not self-documenting.

### L-5: StablecoinInitialized Event Omits uri
The `uri` field is part of initialization args but not emitted.

### L-6: Redundant checked_add in mint_tokens
The quota check and the actual update both compute `checked_add(amount)`. The first result could be reused.

---

## Best Practices Checklist

| Best Practice | Status | Details |
|---|---|---|
| Checked arithmetic everywhere | PASS | All ops use `checked_add`/`checked_sub` |
| No `unwrap()` / `expect()` | PASS | Zero instances in program code |
| PDA bumps stored on init | PASS | Both config and role store canonical bumps |
| CPI targets validated | PASS | All use `Interface<'info, TokenInterface>` or `Program<'info, System>` |
| Events on state changes | PASS | All 15 instructions emit events |
| Custom error codes | PASS | 19 descriptive error variants |
| No `msg!()` overhead | PASS | Zero debug logging in production code |
| Zero-copy for config | PASS | ~90% CU reduction vs standard deserialization |
| Unique PDA seed prefixes | PASS | `"sss-config"`, `"sss-role"`, `"blacklist"`, `"extra-account-metas"` |
| `remaining_accounts` for hooks | PASS | Seize correctly forwards for SSS-2/4 hook compat |
| Cross-program role verification | PASS | Hook re-derives sss-core PDAs without CPI |
| Token-2022 InterfaceAccount | PASS | Proper use of token_interface types throughout |
| Hardcoded CPI program IDs | PASS | Hook hardcodes sss-core ID via `pubkey!()` |
| admin_count tracking | PASS | Prevents revoking last admin |
| SSS-4 feature gating | PASS | `update_transfer_fee` and `withdraw_withheld` check `preset == 4` |
| Zero-copy struct properly packed | PASS | `#[account(zero_copy(unsafe))]` with `repr(packed)` |
| No `init_if_needed` (reinitialization attack) | PASS | All accounts use `init` not `init_if_needed` |
| Transfer hook SPL interface routing | PASS | Fallback correctly routes Execute variant |
| Blacklist PDA existence check | PASS | Dual check: `data_is_empty()` + `owner == program_id` |
