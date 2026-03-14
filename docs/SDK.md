# SDK Reference — `@stbr/sss-token`

The TypeScript SDK provides a complete client for creating, managing, and interacting with SSS stablecoins. It wraps both on-chain programs (`sss-core` and `sss-transfer-hook`) behind a single `SolanaStablecoin` class.

## Installation

```bash
npm install @stbr/sss-token
```

**Peer dependencies:** `@solana/web3.js`, `@coral-xyz/anchor`, `@solana/spl-token`

## Quick Start

### Create a New Stablecoin

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { SolanaStablecoin, Preset } from "@stbr/sss-token";
import { BN } from "bn.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = new Wallet(Keypair.fromSecretKey(/* ... */));

const { stablecoin, mintKeypair, signature } = await SolanaStablecoin.create(
  connection,
  wallet,
  {
    preset: Preset.SSS_2,
    name: "Regulated USD",
    symbol: "rUSD",
    uri: "https://example.com/metadata.json",
    decimals: 6,
    supplyCap: new BN(1_000_000_000_000), // optional
  }
);

console.log("Mint:", mintKeypair.publicKey.toBase58());
console.log("Config PDA:", stablecoin.configPda.toBase58());
```

### Load an Existing Stablecoin

```typescript
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";

const stablecoin = SolanaStablecoin.load(
  connection,
  wallet,
  new PublicKey("MINT_ADDRESS_HERE")
);

const info = await stablecoin.getInfo();
console.log(`${info.name} (${info.symbol}) — Preset SSS-${info.preset}`);
```

## Preset-Specific Examples

### SSS-1: Minimal

```typescript
const { stablecoin } = await SolanaStablecoin.create(connection, wallet, {
  preset: Preset.SSS_1,
  name: "DAO Token",
  symbol: "DAO",
  uri: "",
  decimals: 6,
});
```

### SSS-2: Regulated

```typescript
const { stablecoin } = await SolanaStablecoin.create(connection, wallet, {
  preset: Preset.SSS_2,
  name: "Regulated USD",
  symbol: "rUSD",
  uri: "https://example.com/rusd.json",
  decimals: 6,
});
// Transfer hook is automatically initialized for SSS-2
```

### SSS-3: Confidential

```typescript
const { stablecoin } = await SolanaStablecoin.create(connection, wallet, {
  preset: Preset.SSS_3,
  name: "Confidential USD",
  symbol: "cUSD",
  uri: "",
  decimals: 6,
});
```

### SSS-4: Monetized

```typescript
const { stablecoin } = await SolanaStablecoin.create(connection, wallet, {
  preset: Preset.SSS_4,
  name: "PayCoin",
  symbol: "PAY",
  uri: "https://example.com/pay.json",
  decimals: 6,
  transferFeeBasisPoints: 50, // 0.5%
  maximumFee: new BN(1_000_000), // 1 token max
});
```

## API Reference

### `SolanaStablecoin` Class

#### Properties

| Property | Type | Description |
|---|---|---|
| `connection` | `Connection` | Solana RPC connection |
| `coreProgram` | `Program` | Anchor program instance for sss-core |
| `hookProgram` | `Program` | Anchor program instance for sss-transfer-hook |
| `mint` | `PublicKey` | Mint address |
| `configPda` | `PublicKey` | Config PDA address |
| `configBump` | `number` | Config PDA bump |

#### Factory Methods

##### `SolanaStablecoin.create(connection, wallet, config, signers?)`

Creates a new stablecoin from scratch. Builds the mint transaction with preset-appropriate Token-2022 extensions, initializes the config, and (for SSS-2/4) initializes the transfer hook ExtraAccountMetas.

```typescript
static async create(
  connection: Connection,
  wallet: Wallet,
  config: CreateStablecoinConfig,
  signers?: Signer[]
): Promise<{
  stablecoin: SolanaStablecoin;
  mintKeypair: Keypair;
  signature: TransactionSignature;
}>
```

##### `SolanaStablecoin.load(connection, wallet, mint)`

Loads an existing stablecoin by mint address.

```typescript
static load(
  connection: Connection,
  wallet: Wallet,
  mint: PublicKey
): SolanaStablecoin
```

#### Read Operations

| Method | Returns | Description |
|---|---|---|
| `getInfo()` | `Promise<StablecoinInfo>` | Fetch full config state |
| `getTotalSupply()` | `Promise<BN>` | Current supply (minted - burned) |
| `getRoleInfo(address, role)` | `Promise<RoleInfo \| null>` | Get role details for an address |
| `isBlacklisted(address)` | `Promise<boolean>` | Check if address is blacklisted |

#### Write Operations

| Method | Parameters | Description |
|---|---|---|
| `mintTokens(params)` | `MintParams` | Mint tokens to a recipient (creates ATA if needed) |
| `burnTokens(params)` | `BurnParams` | Burn tokens from a token account |
| `freezeAccount(freezer, tokenAccount)` | `PublicKey, PublicKey` | Freeze a token account |
| `thawAccount(freezer, tokenAccount)` | `PublicKey, PublicKey` | Thaw a frozen token account |
| `pause(pauser)` | `PublicKey` | Globally pause operations |
| `unpause(pauser)` | `PublicKey` | Resume operations |
| `seize(params)` | `SeizeParams` | Force-transfer via PermanentDelegate |

#### `roles` Namespace

| Method | Description |
|---|---|
| `roles.grant(admin, grantee, role)` | Grant a role to an address |
| `roles.revoke(admin, address, role)` | Revoke a role |
| `roles.proposeAuthority(admin, newAuthority)` | Propose authority transfer |
| `roles.acceptAuthority(newAuthority, oldAuthority)` | Accept authority transfer |
| `roles.updateSupplyCap(admin, newCap)` | Set or remove supply cap (pass `null` to remove) |
| `roles.updateMinterQuota(admin, minter, newQuota)` | Set or remove per-minter quota |

#### `compliance` Namespace

| Method | Description |
|---|---|
| `compliance.blacklistAdd(authority, address, reason)` | Add address to blacklist |
| `compliance.blacklistRemove(authority, address)` | Remove address from blacklist |
| `compliance.isBlacklisted(address)` | Check blacklist status |

#### `fees` Namespace (SSS-4)

| Method | Description |
|---|---|
| `fees.updateFee(admin, basisPoints, maximumFee)` | Update transfer fee config |
| `fees.withdrawWithheld(admin, feeDestination, sources?)` | Sweep collected fees |
| `fees.getConfig()` | Get current fee configuration |

## Types

### `CreateStablecoinConfig`

```typescript
interface CreateStablecoinConfig {
  preset: Preset;           // 1-4
  name: string;             // max 32 chars
  symbol: string;           // max 10 chars
  uri: string;              // max 200 chars
  decimals: number;
  supplyCap?: BN;           // optional global cap
  oracleFeedId?: number[];  // optional oracle
  transferFeeBasisPoints?: number; // SSS-4
  maximumFee?: BN;          // SSS-4
}
```

### `Preset` Enum

```typescript
enum Preset {
  SSS_1 = 1,
  SSS_2 = 2,
  SSS_3 = 3,
  SSS_4 = 4,
}
```

### `Role` Enum

```typescript
enum Role {
  Admin = 0,
  Minter = 1,
  Freezer = 2,
  Pauser = 3,
  Burner = 4,
  Blacklister = 5,
  Seizer = 6,
}
```

### `StablecoinInfo`

```typescript
interface StablecoinInfo {
  mint: PublicKey;
  config: PublicKey;
  authority: PublicKey;
  preset: Preset;
  name: string;
  symbol: string;
  decimals: number;
  paused: boolean;
  supplyCap: BN | null;
  totalMinted: BN;
  totalBurned: BN;
  currentSupply: BN;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
  adminCount: number;
  transferFeeBasisPoints: number;
  maximumFee: BN;
  hasPendingAuthority: boolean;
  pendingAuthority: PublicKey;
}
```

### Operation Parameters

```typescript
interface MintParams {
  recipient: PublicKey;
  amount: BN;
  minter: PublicKey;
}

interface BurnParams {
  from: PublicKey;  // token account
  amount: BN;
  burner: PublicKey;
}

interface SeizeParams {
  from: PublicKey;  // source token account
  to: PublicKey;    // destination token account
  amount: BN;
  seizer: PublicKey;
}

interface FeeConfig {
  basisPoints: number;
  maximumFee: BN;
}
```

## PDA Helper Functions

The SDK exports deterministic PDA derivation functions:

```typescript
import {
  deriveConfigPda,
  deriveRolePda,
  deriveBlacklistPda,
  deriveExtraAccountMetasPda,
} from "@stbr/sss-token";

// Config PDA: seeds = ["sss-config", mint]
const [configPda, bump] = deriveConfigPda(mintPublicKey);

// Role PDA: seeds = ["sss-role", config, address, role_u8]
const [rolePda] = deriveRolePda(configPda, userPublicKey, Role.Minter);

// Blacklist PDA: seeds = ["blacklist", mint, address]
const [blacklistPda] = deriveBlacklistPda(mintPublicKey, userPublicKey);

// ExtraAccountMetas PDA: seeds = ["extra-account-metas", mint]
const [metasPda] = deriveExtraAccountMetasPda(mintPublicKey);
```

## Error Codes

### sss-core Errors

| Code | Name | Message |
|---|---|---|
| 6000 | `Paused` | Operations are paused |
| 6001 | `NotPaused` | Operations are not paused |
| 6002 | `SupplyCapExceeded` | Supply cap exceeded |
| 6003 | `Unauthorized` | Unauthorized: missing required role |
| 6004 | `InvalidPreset` | Invalid preset value (must be 1-4) |
| 6005 | `LastAdmin` | Cannot remove the last admin |
| 6006 | `ArithmeticOverflow` | Overflow in arithmetic operation |
| 6007 | `MintMismatch` | Mint mismatch |
| 6008 | `InvalidSupplyCap` | Invalid supply cap: must be >= current supply |
| 6009 | `ZeroAmount` | Amount must be greater than zero |
| 6010 | `InvalidRole` | Invalid role value |
| 6011 | `InvalidOracleData` | Invalid oracle price feed data |
| 6012 | `InvalidOraclePrice` | Oracle price is stale or non-positive |
| 6013 | `QuotaExceeded` | Minter quota exceeded |
| 6014 | `NameTooLong` | Name exceeds maximum length of 32 characters |
| 6015 | `SymbolTooLong` | Symbol exceeds maximum length of 10 characters |
| 6016 | `UriTooLong` | URI exceeds maximum length of 200 characters |
| 6017 | `NotSss4` | Instruction requires SSS-4 preset |
| 6018 | `InvalidFeeBasisPoints` | Transfer fee basis points cannot exceed 10000 |
| 6019 | `NoPendingAuthority` | No pending authority transfer to accept |
| 6020 | `UnauthorizedAcceptor` | Signer does not match the pending authority |

### sss-transfer-hook Errors

| Code | Name | Message |
|---|---|---|
| 6000 | `SenderBlacklisted` | Sender is blacklisted |
| 6001 | `ReceiverBlacklisted` | Receiver is blacklisted |
| 6002 | `ReasonTooLong` | Reason exceeds maximum length of 128 characters |
| 6003 | `Unauthorized` | Unauthorized: missing required role |

### Error Handling

The SDK automatically translates Anchor errors into typed `SssError` instances:

```typescript
import { SssError } from "@stbr/sss-token";

try {
  await stablecoin.mintTokens({ /* ... */ });
} catch (err) {
  if (err instanceof SssError) {
    console.error(`SSS Error ${err.code}: ${err.message}`);
    // e.g., "SSS Error 6002: Supply cap exceeded"
  }
}
```

## Custom Configuration Example

```typescript
import { SolanaStablecoin, Preset, Role } from "@stbr/sss-token";
import { BN } from "bn.js";

// 1. Create an SSS-4 stablecoin with all options
const { stablecoin } = await SolanaStablecoin.create(connection, wallet, {
  preset: Preset.SSS_4,
  name: "Enterprise Pay",
  symbol: "ePAY",
  uri: "https://pay.example.com/metadata.json",
  decimals: 6,
  supplyCap: new BN(10_000_000_000_000),     // 10M tokens
  transferFeeBasisPoints: 0,                   // start with zero fees
  maximumFee: new BN(0),
});

// 2. Set up role hierarchy
await stablecoin.roles.grant(wallet.publicKey, minterKey, Role.Minter);
await stablecoin.roles.grant(wallet.publicKey, freezerKey, Role.Freezer);
await stablecoin.roles.grant(wallet.publicKey, blacklisterKey, Role.Blacklister);
await stablecoin.roles.grant(wallet.publicKey, pauserKey, Role.Pauser);

// 3. Set per-minter quota
await stablecoin.roles.updateMinterQuota(
  wallet.publicKey,
  minterKey,
  new BN(1_000_000_000) // 1000 tokens
);

// 4. Mint tokens
await stablecoin.mintTokens({
  minter: minterKey,
  recipient: userPublicKey,
  amount: new BN(100_000_000),
});

// 5. KYC approve a user (thaw their account for SSS-2/4)
await stablecoin.thawAccount(freezerKey, userAta);

// 6. Enable fees after growth phase
await stablecoin.fees.updateFee(wallet.publicKey, 25, new BN(500_000));

// 7. Transfer authority to a multisig
await stablecoin.roles.proposeAuthority(wallet.publicKey, multisigKey);
// multisig accepts:
await stablecoin.roles.acceptAuthority(multisigKey, wallet.publicKey);
```

## Constants

```typescript
const SSS_CORE_PROGRAM_ID = new PublicKey("CoREsjH41J3KezywbudJC4gHqCE1QhNWaXRbC1QjA9ei");
const SSS_TRANSFER_HOOK_PROGRAM_ID = new PublicKey("HooKchDVVKm7GkAX4w75bbaQUbMcDUnYXSzqLZCWKCDH");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
```
