# Solana Stablecoin Standard (SSS) Compliance Architecture

This document describes how the Solana Stablecoin Standard technically fulfills the requirements of incoming global regulatory frameworks, specifically focusing on the principles of the US GENIUS Act of 2025 and European MiCA regulations.

## 1. Identity & AML/KYC Validation (SSS-2 & SSS-4)

The SSS architecture separates the *record of identity* (managed off-chain by the issuer/bank) from the *verification of identity* (managed on-chain).

### Default Frozen State
Regulators demand that unidentified addresses cannot hold regulated fiat assets. 
* By enabling `DefaultAccountState(Frozen)`, any newly created token account for an SSS-2 or SSS-4 mint is entirely immobile. 
* Once an institution completes off-chain KYC (via providers like Chainalysis, Elliptic, or Jumio), their infrastructure calls the `Thaw` instruction using the `Freezer` Role PDA.

### Transaction Level Monitoring (Transfer Hooks)
The `sss-transfer-hook` guarantees that *every* transaction flows through an on-chain policy engine. The `Blacklister` Role PDA maintains the state of the Blacklist PDA. If an address interacts with a sanctioned entity (OFAC list), the backend can instantly add that address to the blacklist, locking the funds instantly across all DeFi protocols.

## 2. Financial Controls: Asset Seizure

The GENIUS Act requires stablecoin issuers to have the ability to freeze and reverse transactions involving criminal activity (hacks, fraud, terrorism financing).

* **Mechanism:** The `PermanentDelegate` extension is permanently bound to the `Seizer` Role PDA.
* **Flow:** Upon receiving a valid law enforcement request, the institution invokes the `seize` instruction, which forcefully burns the tokens from the malicious user's account and re-mints them (or transfers them) to a controlled treasury account. The `ImmutableOwner` extension (SSS-4) guarantees the hacker cannot change the token account ownership to evade seizure.

## 3. Privacy vs. Auditability (SSS-3)

Dark pools and enterprise B2B settlements require privacy, but regulators require auditability. "Privacy coins" that lack backdoors are routinely delisted by major exchanges.

* **Mechanism:** The SSS-3 preset utilizes `ConfidentialTransferMint` with a highly specific configuration: The **Auditor Key**.
* **Flow:** While peer-to-peer transfers are encrypted with ElGamal and invisible to block explorers, the issuer retains an Auditor Private Key. This key can symmetrically decrypt any transaction amount on the ledger, providing a complete, historical audit trail to regulators upon subpoena, without leaking competitor data to the public.

## 4. Off-Chain Indexing & Audit Trails

Compliance relies heavily on robust historical record-keeping. The SSS backend services utilize Rust Axum indexers to consume RPC WebSocket streams.
* Every `Mint`, `Burn`, `Seize`, `Freeze`, and `Blacklist` action emits a strongly typed Anchor Event.
* The indexer writes these events to a PostgreSQL database, creating an immutable off-chain audit trail that can be exported as CSV/JSON for regulatory reporting (PCAOB-registered accounting firm reviews).
