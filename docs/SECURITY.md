# Solana Stablecoin Standard (SSS) Security & Threat Model

This document outlines the security architecture, threat models, and mitigation strategies for the Solana Stablecoin Standard. The SSS is built to handle billions in Total Value Locked (TVL) and assumes a hostile on-chain environment.

## 1. Trust Assumptions & Access Control

Unlike highly decentralized DeFi protocols, fiat-backed stablecoins require administrative control. The SSS security model is built around **Role-Based Access Control (RBAC)** governed by Program Derived Addresses (PDAs). No single keypair has root access unless explicitly configured that way via the `StablecoinConfig`.

### PDA Authorization Matrix

| Action | Allowed Role | PDA Seeds Required |
|--------|-------------|--------------------|
| Update Config | Admin | `["role", config_pubkey, signer, Admin(0)]` |
| Mint Supply | Minter | `["role", config_pubkey, signer, Minter(1)]` |
| Burn Supply | Burner | `["role", config_pubkey, signer, Burner(4)]` |
| Freeze/Thaw | Freezer | `["role", config_pubkey, signer, Freezer(2)]` |
| Global Pause | Pauser | `["role", config_pubkey, signer, Pauser(3)]` |
| Force Seize | Seizer | `["role", config_pubkey, signer, Seizer(6)]` |
| Edit Blacklist | Blacklister | `["role", config_pubkey, signer, Blacklister(5)]` |

**Mitigation:** The "Last Admin" check in the `manage_roles` instruction panics if an `Admin` attempts to revoke their own role and the total admin count would drop to zero, preventing the protocol from soft-bricking.

## 2. Token-2022 CPI Attack Vectors

The Token-2022 extensions open new attack vectors through Cross-Program Invocations (CPIs).

### Threat: Transfer Hook Hijacking (SSS-2 / SSS-4)
A malicious actor could attempt to bypass the blacklist by constructing a transfer transaction that drops the required `ExtraAccountMetaList`, hoping the Token-2022 program ignores the hook.
* **Mitigation:** The Solana Runtime enforces that if a mint has the `TransferHook` extension enabled, the transfer *must* invoke the configured hook program ID. If the required accounts are missing, the Solana validator fails the transaction before it ever reaches our logic.

### Threat: Permanent Delegate Privilege Escalation
The `PermanentDelegate` has the power to transfer or burn tokens from any account. A malicious program could attempt a CPI into our `seize` instruction.
* **Mitigation:** The `seize` instruction hard-requires the signer to be the owner of a valid `Seizer` Role PDA. The Anchor `#[derive(Accounts)]` framework explicitly validates the `signer_is_signer` and `seeds/bump` constraints before the function body executes.

## 3. The "Seize" + "Transfer Hook" Limitation

A known edge case in Token-2022 involves executing a `TransferChecked` CPI (via `seize`) on a mint that also has a `TransferHook` enabled (SSS-2, SSS-4).

Native `anchor-spl` CPIs do not magically forward the extra accounts required by the transfer hook. If a `seizer` attempts to force-transfer tokens, the inner Token-2022 CPI will panic due to missing accounts.

* **SSS Mitigation:** The `seize` instruction in SSS-2 and SSS-4 explicitly checks `ctx.remaining_accounts` and appends them to the Token-2022 CPI. The off-chain Typescript SDK automatically derives the `ExtraAccountMetaList` and Hook Program ID, pushing them into the transaction's remaining accounts array, guaranteeing the `seize` succeeds while still honoring the hook's validation.

## 4. Arithmetic & Overflow Hazards

All arithmetic operations (supply calculations, mint quotas, transfer fee percentages) utilize standard Rust `checked_add`, `checked_sub`, and `checked_mul`. Any overflow instantly panics via the `SssError::MathOverflow` custom error, reverting the transaction.

## 5. Audit History & Recommendations

The SSS codebase has undergone initial security reviews. **Current audit reports can be found in the [.audit/](../.audit/) directory.**

### Existing Reports
- [Initial Security Scan - March 2026](../.audit/2026-03-07-audit-report.md)

### Future Recommendations
Before high-value mainnet deployment, the SSS codebase should undergo:
1. Formal Verification of the RBAC PDA derivations.
2. Property-based and integration testing (LiteSVM, Anchor tests) focusing on the `sss-transfer-hook` bounds. See [TRIDENT_INTEGRATION_ANALYSIS.md](TRIDENT_INTEGRATION_ANALYSIS.md) for technical reasoning on Trident + Token-2022 compatibility.
