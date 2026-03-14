# SSS-3: Confidential Stablecoin

The SSS-3 preset leverages Solana's native Zero-Knowledge cryptography to issue privacy-preserving tokens that hide transfer amounts while retaining administrative controls and optional auditability via an Auditor Key.

**Target Audience:** Enterprises, payroll providers, OTC trading desks, B2B supplier payments, institutional dark pools.

## Token-2022 Extensions

| Extension | Configuration |
|---|---|
| `MetadataPointer` | Points to the mint itself |
| `PermanentDelegate` | Set to the config PDA |
| `FreezeAuthority` | Set to the config PDA |
| `MintAuthority` | Set to the config PDA |
| `ConfidentialTransferMint` | Configured with optional authority and auto-approve |

SSS-3 does **not** use TransferHook or DefaultAccountState. Transfer-time blacklisting is not enforced; privacy is the priority. Compliance is managed through the Auditor Key mechanism and administrative freeze/seize capabilities.

## How Confidential Transfers Work

Unlike standard Token-2022 where the `amount` field is a public `u64`, SSS-3 token accounts hold ElGamal-encrypted ciphertexts representing balances.

When Alice sends 100 cUSD to Bob:
1. Alice's client generates a Zero-Knowledge Proof (ZKP) that she has at least 100 cUSD in her encrypted balance.
2. The transaction encrypts "100" with Bob's public key and adds the ciphertext to his "pending" balance.
3. The transaction encrypts "100" with Alice's public key and subtracts it from her available balance.
4. If an Auditor Key is configured, the amount is also encrypted with the Auditor's key.

To an outside observer, the transferred amount is completely hidden. Only Alice, Bob, and the Auditor (if configured) can decrypt the amounts.

## Regulatory Compliance: The Auditor Key

During initialization, the issuer can configure an Auditor Public Key. Every confidential transfer encrypts the amount a third time using this key. The issuer can provide the corresponding private key to regulators upon request, enabling a complete historical audit trail without exposing data publicly.

```typescript
const { stablecoin } = await SolanaStablecoin.create(connection, wallet, {
  preset: Preset.SSS_3,
  name: "Confidential USD",
  symbol: "cUSD",
  uri: "https://example.com/cusd.json",
  decimals: 6,
});
```

## Available Instructions

| Instruction | Available | Notes |
|---|:---:|---|
| `initialize` | Yes | Creates mint with ConfidentialTransferMint |
| `mint_tokens` | Yes | Minter role |
| `burn_tokens` | Yes | Burner role |
| `freeze_account` | Yes | Freezer role |
| `thaw_account` | Yes | Freezer role |
| `pause` / `unpause` | Yes | Pauser role |
| `seize` | Yes | Seizer role, via PermanentDelegate |
| `grant_role` / `revoke_role` | Yes | Admin role |
| `propose_authority` / `accept_authority` | Yes | Two-step authority transfer |
| `update_supply_cap` | Yes | Admin role |
| `update_minter` | Yes | Admin role |
| `update_transfer_fee` | No | SSS-4 only |
| `withdraw_withheld` | No | SSS-4 only |
| Blacklist operations | No | Requires TransferHook (SSS-2/4) |

## Applicable Roles

| Role | Applicable | Notes |
|---|:---:|---|
| Admin (0) | Yes | |
| Minter (1) | Yes | |
| Freezer (2) | Yes | |
| Pauser (3) | Yes | |
| Burner (4) | Yes | |
| Blacklister (5) | No | No TransferHook |
| Seizer (6) | Yes | |

## SDK Usage

```typescript
import { SolanaStablecoin, Preset } from "@stbr/sss-token";

const { stablecoin, mintKeypair } = await SolanaStablecoin.create(
  connection,
  wallet,
  {
    preset: Preset.SSS_3,
    name: "Confidential USD",
    symbol: "cUSD",
    uri: "https://example.com/cusd.json",
    decimals: 6,
  }
);
```

## CLI Usage

```bash
sss-token init --preset 3 --name "Confidential USD" --symbol "cUSD" --decimals 6

sss-token mint --to <RECIPIENT> --amount 1000000
sss-token status
```

## Technical Requirements

- Confidential transfer proofs require the `@solana/web3.js` library with `solana-zk-sdk` backend support.
- Users must call `apply_pending` on their accounts to move incoming encrypted transfers from their pending balance into their spendable available balance.
- ZK proof generation adds client-side latency compared to standard transfers.
