# CLI Reference — `sss-token`

The SSS CLI is a **Rust (clap) application** that provides operator commands for the full stablecoin lifecycle: creation, minting, burning, compliance, role management, and fee administration. Single binary, no Node.js required.

## Installation

```bash
# From workspace root
cargo build -p sss-cli --release

# Or install globally
cargo install --path cli
```

The binary `sss-token` will be at `target/release/sss-token` or in your `$PATH` after `cargo install`.

## Configuration

### Global Options

| Option | Flag | Environment Variable | Default |
|---|---|---|---|
| RPC URL | `--rpc-url <url>` | `SOLANA_RPC_URL` | `https://api.devnet.solana.com` |
| Keypair path | `--keypair <path>` | `SOLANA_KEYPAIR` | `~/.config/solana/id.json` |
| Commitment | `--commitment <level>` | — | `confirmed` |

### Environment Variables

| Variable | Description |
|---|---|
| `SOLANA_RPC_URL` | Solana cluster RPC endpoint |
| `SOLANA_KEYPAIR` | Path to JSON keypair file |
| `SSS_MINT` | Default mint address (avoids `--mint` on every command) |

Set up your environment:

```bash
export SOLANA_RPC_URL="https://api.devnet.solana.com"
export SOLANA_KEYPAIR="~/.config/solana/id.json"
export SSS_MINT="<YOUR_MINT_ADDRESS>"
```

## Commands

### `init` — Initialize a New Stablecoin

Creates a new Token-2022 mint with the specified preset and initializes the on-chain config. The CLI builds mint creation instructions in Rust (PermanentDelegate, TransferHook, DefaultAccountState, TransferFeeConfig for SSS-4). SSS-3 requires the TypeScript SDK and will bail with instructions.

```bash
# Preset + name/symbol (mint keypair generated if --mint omitted)
sss-token init --preset 2 --name "Regulated USD" --symbol "rUSD" [--uri <string>] [--decimals 6] [--supply-cap <n>] [--mint <path>]

# Or use a TOML config file (preset inferred from enable_transfer_hook)
sss-token init --config stablecoin.toml [--mint <path>]
```

| Option | Required | Default | Description |
|---|:---:|---|---|
| `--preset` | Yes* | — | Preset: 1, 2, 4 or sss-1, sss-2, sss-4. Omit if using `--config` |
| `--config` | No | — | Path to TOML config (alternative to preset/name/symbol) |
| `--mint` | No | — | Path to mint keypair JSON. Omit to generate new keypair |
| `--name` | Yes* | — | Token name (max 32 chars). Omit if using `--config` |
| `--symbol` | Yes* | — | Token symbol (max 10 chars). Omit if using `--config` |
| `--uri` | No | `""` | Metadata URI |
| `--decimals` | No | `6` | Token decimals |
| `--supply-cap` | No | None | Global supply cap in base units |

*Either `--config` or `--preset` + `--name` + `--symbol` required.

**Example:**

```bash
sss-token init --preset 2 --name "Regulated USD" --symbol "rUSD" --decimals 6
# Output:
#   ✓ Stablecoin initialized (SSS-2 (Compliance Stablecoin))
#     Mint:              7xKL...
#   Config:    9yAB...
#   Signature: 5zCD...
#   Set environment variable: export SSS_MINT=7xKL...
```

### `mint` — Mint Tokens

```bash
sss-token mint --to <address> --amount <number> [--mint <address>]
```

Mints tokens to a recipient. Automatically creates the recipient's Associated Token Account if it doesn't exist.

```bash
sss-token mint --to 9ABC...xyz --amount 1000000000
```

### `burn` — Burn Tokens

```bash
sss-token burn --from <token_account> --amount <number> [--mint <address>]
```

Burns tokens from a specified token account. Requires Burner role.

```bash
sss-token burn --from 8DEF...abc --amount 500000000
```

### `freeze` — Freeze a Token Account

```bash
sss-token freeze --account <token_account> [--mint <address>]
```

Freezes a token account, preventing all transfers. Requires Freezer role.

### `thaw` — Thaw a Frozen Token Account

```bash
sss-token thaw --account <token_account> [--mint <address>]
```

Thaws a frozen token account. For SSS-2/4, this is the KYC approval step.

### `pause` — Pause Operations

```bash
sss-token pause [--mint <address>]
```

Globally pauses mint and burn operations. Requires Pauser role.

### `unpause` — Resume Operations

```bash
sss-token unpause [--mint <address>]
```

Resumes paused operations.

### `seize` — Seize Tokens (SSS-2/4)

```bash
sss-token seize \
  --from <source_token_account> \
  --to <destination_token_account> \
  --amount <number> \
  [--mint <address>]
```

Force-transfers tokens via PermanentDelegate. Requires Seizer role. The CLI handles transfer hook account resolution automatically.

### `status` — Show Stablecoin Status

```bash
sss-token status [--mint <address>]
```

Displays the full config state:

```
Stablecoin Status
──────────────────────────────────────────────────
  Preset:     SSS-2
  Name:       Regulated USD
  Symbol:     rUSD
  Decimals:   6
  Mint:       7xKL...
  Authority:  3yAB...
  Paused:     NO
  Supply Cap: 1000000000000
  Minted:     500000000
  Burned:     0
  Supply:     500000000
  Admins:     2
```

### `supply` — Show Current Supply

```bash
sss-token supply [--mint <address>]
```

### `blacklist` — Manage Blacklist (SSS-2/4)

#### Add to Blacklist

```bash
sss-token blacklist add \
  --address <address> \
  --reason <string> \
  [--mint <address>]
```

#### Remove from Blacklist

```bash
sss-token blacklist remove --address <address> [--mint <address>]
```

#### Check Blacklist Status

```bash
sss-token blacklist check --address <address> [--mint <address>]
```

### `roles` — Manage Roles

#### Grant a Role

```bash
sss-token roles grant \
  --address <address> \
  --role <admin|minter|freezer|pauser|burner|blacklister|seizer> \
  [--mint <address>]
```

#### Revoke a Role

```bash
sss-token roles revoke \
  --address <address> \
  --role <admin|minter|freezer|pauser|burner|blacklister|seizer> \
  [--mint <address>]
```

### `minters` — Manage Minters

#### Add a Minter (with Optional Quota)

```bash
sss-token minters add \
  --address <address> \
  [--quota <number>] \
  [--mint <address>]
```

Grants the Minter role and optionally sets a minting quota.

#### Remove a Minter

```bash
sss-token minters remove --address <address> [--mint <address>]
```

### `fees` — Manage Transfer Fees (SSS-4)

```bash
# Show current fee config
sss-token fees [--mint <address>]

# Update fee rate
sss-token fees --update-bps <number> --update-max <number> [--mint <address>]

# Withdraw collected fees
sss-token fees --withdraw-to <token_account> [--mint <address>]
```

## Example Workflows

### Create and Operate an SSS-1 Stablecoin

```bash
# Create
sss-token init --preset 1 --name "DAO Token" --symbol "DAO"
export SSS_MINT=<output_mint_address>

# Add a minter with quota
sss-token minters add --address <MINTER_KEY> --quota 1000000000

# Mint tokens
sss-token mint --to <RECIPIENT> --amount 500000000

# Check status
sss-token status
sss-token supply
```

### Create and Operate an SSS-2 Regulated Stablecoin

```bash
# Create
sss-token init --preset 2 --name "Regulated USD" --symbol "rUSD"
export SSS_MINT=<output_mint_address>

# Set up roles
sss-token roles grant --address <FREEZER_KEY> --role freezer
sss-token roles grant --address <BLACKLISTER_KEY> --role blacklister
sss-token roles grant --address <SEIZER_KEY> --role seizer
sss-token minters add --address <MINTER_KEY>

# Mint tokens
sss-token mint --to <USER> --amount 1000000000

# KYC approve user (thaw their account)
sss-token thaw --account <USER_ATA>

# Blacklist a sanctioned address
sss-token blacklist add --address <BAD_ACTOR> --reason "OFAC-SDN-2026"

# Emergency seizure
sss-token seize --from <BAD_ACTOR_ATA> --to <TREASURY_ATA> --amount 1000000000
```

### Create an SSS-4 Monetized Stablecoin

```bash
# Create with zero fees
sss-token init --preset 4 --name "PayCoin" --symbol "PAY" --fee-bps 0 --max-fee 0
export SSS_MINT=<output_mint_address>

# Set up operations
sss-token minters add --address <MINTER_KEY>
sss-token roles grant --address <FREEZER_KEY> --role freezer

# Enable fees after growth
sss-token fees --update-bps 50 --update-max 1000000

# Collect fees
sss-token fees --withdraw-to <TREASURY_ATA>
```
