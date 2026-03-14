# SSS-1: Minimal Utility Stablecoin

The SSS-1 preset implements the minimum requirements for an operational stablecoin on Solana. It provides basic administrative controls with no transfer-time compliance overhead.

**Target Audience:** DAO treasuries, ecosystem rewards, internal settlement layers, non-regulated utility tokens.

## Token-2022 Extensions

| Extension | Configuration |
|---|---|
| `MetadataPointer` | Points to the mint itself — name, symbol, URI stored on-chain |
| `PermanentDelegate` | Set to the config PDA (enables seize capability if needed) |
| `FreezeAuthority` | Set to the config PDA |
| `MintAuthority` | Set to the config PDA |

SSS-1 does **not** use TransferHook, DefaultAccountState, ConfidentialTransferMint, or TransferFeeConfig. Transfers behave identically to standard Token-2022 transfers with no CPI overhead.

## Available Instructions

| Instruction | Available | Notes |
|---|:---:|---|
| `initialize` | Yes | Creates SSS-1 mint with MetadataPointer + PermanentDelegate |
| `mint_tokens` | Yes | Minter role, subject to optional quota |
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

| Role | Applicable |
|---|:---:|
| Admin (0) | Yes |
| Minter (1) | Yes |
| Freezer (2) | Yes |
| Pauser (3) | Yes |
| Burner (4) | Yes |
| Blacklister (5) | No (no TransferHook) |
| Seizer (6) | Yes |

## SDK Usage

```typescript
import { SolanaStablecoin, Preset } from "@stbr/sss-token";

const { stablecoin, mintKeypair, signature } = await SolanaStablecoin.create(
  connection,
  wallet,
  {
    preset: Preset.SSS_1,
    name: "DAO Token",
    symbol: "DAO",
    uri: "https://example.com/metadata.json",
    decimals: 6,
    supplyCap: new BN(1_000_000_000_000), // optional
  }
);

console.log("Mint:", mintKeypair.publicKey.toBase58());
```

## CLI Usage

```bash
sss-token init \
  --preset 1 \
  --name "DAO Token" \
  --symbol "DAO" \
  --decimals 6

sss-token mint --to <RECIPIENT> --amount 1000000
sss-token burn --from <TOKEN_ACCOUNT> --amount 500000
sss-token freeze --account <TOKEN_ACCOUNT>
sss-token thaw --account <TOKEN_ACCOUNT>
```

## Compute Cost

Because SSS-1 does not invoke a Transfer Hook CPI, transfers require the lowest CU budget of all presets, consistently profiling at **< 10,000 CU** per transfer.
