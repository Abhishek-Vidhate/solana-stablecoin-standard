# Operations Runbook

This document provides step-by-step procedures for operating a stablecoin built with the Solana Stablecoin Standard. It covers initial deployment, day-to-day operations, compliance workflows, and emergency procedures.

## Prerequisites

- Solana CLI installed and configured
- Anchor CLI v0.31.1+
- Node.js 18+
- An operator keypair with SOL for transaction fees
- Environment variables configured:

```bash
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
export SOLANA_KEYPAIR="~/.config/solana/id.json"
```

---

## 1. Initial Setup and Deployment

### Build Programs

```bash
anchor build
```

This produces two programs:
- `target/deploy/sss_core.so` — Core stablecoin logic
- `target/deploy/sss_transfer_hook.so` — Transfer hook compliance

### Deploy to Devnet (Testing)

```bash
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

### Deploy to Mainnet

```bash
solana config set --url mainnet-beta
anchor deploy --provider.cluster mainnet \
  --program-keypair target/deploy/sss_core-keypair.json \
  --program-keypair target/deploy/sss_transfer_hook-keypair.json
```

### Verify Deployment

```bash
solana program show CoREsjH41J3KezywbudJC4gHqCE1QhNWaXRbC1QjA9ei
solana program show HooKchDVVKm7GkAX4w75bbaQUbMcDUnYXSzqLZCWKCDH
```

---

## 2. Creating a Stablecoin

### SSS-1: Minimal Utility

```bash
sss-token init \
  --preset 1 \
  --name "DAO Token" \
  --symbol "DAO" \
  --decimals 6

export SSS_MINT=<output_mint_address>
```

### SSS-2: Regulated Compliant

```bash
sss-token init \
  --preset 2 \
  --name "Regulated USD" \
  --symbol "rUSD" \
  --decimals 6 \
  --supply-cap 10000000000000

export SSS_MINT=<output_mint_address>
```

Post-creation setup for SSS-2:
```bash
# Grant compliance roles
sss-token roles grant --address <FREEZER_KEY> --role freezer
sss-token roles grant --address <BLACKLISTER_KEY> --role blacklister
sss-token roles grant --address <SEIZER_KEY> --role seizer
sss-token roles grant --address <PAUSER_KEY> --role pauser
sss-token minters add --address <MINTER_KEY> --quota 1000000000000
```

### SSS-3: Confidential

```bash
sss-token init \
  --preset 3 \
  --name "Confidential USD" \
  --symbol "cUSD" \
  --decimals 6

export SSS_MINT=<output_mint_address>
```

### SSS-4: Monetized

```bash
sss-token init \
  --preset 4 \
  --name "PayCoin" \
  --symbol "PAY" \
  --decimals 6 \
  --fee-bps 0 \
  --max-fee 0

export SSS_MINT=<output_mint_address>

# Set up compliance roles (same as SSS-2)
sss-token roles grant --address <FREEZER_KEY> --role freezer
sss-token roles grant --address <BLACKLISTER_KEY> --role blacklister
sss-token roles grant --address <SEIZER_KEY> --role seizer
sss-token minters add --address <MINTER_KEY>
```

---

## 3. Day-to-Day Operations

### Minting Tokens

```bash
# Mint 1,000 tokens (decimals=6)
sss-token mint --to <RECIPIENT_WALLET> --amount 1000000000

# Verify supply
sss-token supply
```

Via API:
```bash
curl -X POST http://localhost:3000/operations/mint \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -d '{"mint": "'$SSS_MINT'", "recipient": "<WALLET>", "amount": "1000000000"}'
```

### Burning Tokens

```bash
sss-token burn --from <TOKEN_ACCOUNT> --amount 500000000
```

Via API:
```bash
curl -X POST http://localhost:3000/operations/burn \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -d '{"mint": "'$SSS_MINT'", "from": "<TOKEN_ACCOUNT>", "amount": "500000000"}'
```

### Checking Status

```bash
sss-token status
sss-token supply
```

---

## 4. Compliance Operations (SSS-2, SSS-4)

### KYC Approval (Thawing Accounts)

For SSS-2 and SSS-4, new token accounts start frozen. After completing off-chain KYC verification, thaw the user's account:

```bash
# Thaw (KYC approve)
sss-token thaw --account <USER_TOKEN_ACCOUNT>

# Freeze (KYC reject or revoke)
sss-token freeze --account <USER_TOKEN_ACCOUNT>
```

### Blacklist Management

Add addresses that appear on sanctions lists or are involved in illicit activity:

```bash
# Add to blacklist (all transfers to/from this address will fail)
sss-token blacklist add \
  --address <SANCTIONED_WALLET> \
  --reason "OFAC-SDN-2026-001"

# Check status
sss-token blacklist check --address <WALLET>

# Remove from blacklist (after resolution)
sss-token blacklist remove --address <WALLET>
```

Via API:
```bash
curl -X POST http://localhost:3000/compliance/blacklist/add \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -d '{"mint": "'$SSS_MINT'", "address": "<WALLET>", "reason": "OFAC-SDN-2026-001"}'
```

### Emergency Seizure

When law enforcement or regulatory action requires confiscation:

```bash
# 1. Blacklist the target (prevents further transfers)
sss-token blacklist add --address <BAD_ACTOR> --reason "LE-REQUEST-2026-042"

# 2. Freeze their account
sss-token freeze --account <BAD_ACTOR_ATA>

# 3. Seize funds to treasury
sss-token seize \
  --from <BAD_ACTOR_ATA> \
  --to <TREASURY_ATA> \
  --amount <FULL_BALANCE>
```

### Audit Trail

Query the transaction history via the API:

```bash
curl http://localhost:3000/compliance/audit-trail/$SSS_MINT \
  -H "X-API-KEY: $API_KEY"
```

---

## 5. Fee Management (SSS-4)

### View Current Fee Configuration

```bash
sss-token fees
# Output:
#   Fee BPS:    0
#   Max Fee:    0
```

### Enable Transfer Fees

```bash
# Set 50 basis points (0.5%) with a maximum of 1 token
sss-token fees --update-bps 50 --update-max 1000000
```

### Update Fee Rate

```bash
# Reduce to 25 basis points
sss-token fees --update-bps 25 --update-max 500000
```

### Withdraw Collected Fees

Fees accumulate in each recipient's token account as "withheld" amounts. Sweep them to a treasury:

```bash
sss-token fees --withdraw-to <TREASURY_TOKEN_ACCOUNT>
```

### Fee Collection Schedule

Recommended fee collection cadence:

| Token Activity | Recommended Sweep Frequency |
|---|---|
| < 1,000 transfers/day | Weekly |
| 1,000 - 10,000 transfers/day | Daily |
| > 10,000 transfers/day | Every 6 hours |

---

## 6. Role Management

### Viewing Roles

Use the SDK to check role status:

```typescript
const info = await stablecoin.getRoleInfo(userPublicKey, Role.Minter);
if (info) {
  console.log(`Minter since: ${new Date(info.grantedAt.toNumber() * 1000)}`);
  console.log(`Quota: ${info.mintQuota?.toString() ?? "Unlimited"}`);
  console.log(`Minted: ${info.amountMinted.toString()}`);
}
```

### Granting Roles

```bash
sss-token roles grant --address <WALLET> --role minter
sss-token roles grant --address <WALLET> --role freezer
sss-token roles grant --address <WALLET> --role pauser
sss-token roles grant --address <WALLET> --role burner
sss-token roles grant --address <WALLET> --role blacklister
sss-token roles grant --address <WALLET> --role seizer
sss-token roles grant --address <WALLET> --role admin
```

### Revoking Roles

```bash
sss-token roles revoke --address <WALLET> --role minter
```

The program prevents revoking the last admin to avoid bricking the protocol.

### Managing Minter Quotas

```bash
# Add minter with a 1M token quota
sss-token minters add --address <WALLET> --quota 1000000000000

# Remove minter
sss-token minters remove --address <WALLET>
```

### Updating Supply Cap

```bash
# Via SDK
await stablecoin.roles.updateSupplyCap(adminKey, new BN(5_000_000_000_000));

# Remove cap
await stablecoin.roles.updateSupplyCap(adminKey, null);
```

---

## 7. Authority Transfer

Authority transfer uses a two-step propose/accept pattern to prevent accidental lockout.

### Step 1: Propose New Authority

The current authority proposes a new authority. This does not transfer control immediately.

```typescript
await stablecoin.roles.proposeAuthority(currentAuthority, newAuthorityKey);
```

### Step 2: Accept Authority

The proposed authority must explicitly accept:

```typescript
await stablecoin.roles.acceptAuthority(newAuthorityKey, currentAuthority);
```

### Transferring to a Multisig

For production deployments, transfer authority to a Squads multisig:

```typescript
// Current admin proposes the multisig
await stablecoin.roles.proposeAuthority(adminKey, multisigVaultPda);

// Multisig members vote and execute accept_authority
// (via Squads proposal mechanism)
```

---

## 8. Pause / Unpause Procedures

### Emergency Pause

Pausing globally halts all `mint_tokens` and `burn_tokens` operations. Existing transfers between users are not affected by pause (they are governed by freeze/blacklist).

```bash
sss-token pause
```

### Resuming Operations

```bash
sss-token unpause
```

### When to Pause

| Scenario | Action |
|---|---|
| Suspected exploit / vulnerability | Pause immediately |
| Smart contract upgrade in progress | Pause during migration |
| Regulatory hold | Pause + notify compliance team |
| Routine maintenance | Generally not needed (pause only affects mint/burn) |

---

## 9. Monitoring and Audit Trails

### On-Chain Events

Both programs emit strongly typed Anchor events for every state-changing operation:

**sss-core events:**
- `StablecoinInitialized` — New stablecoin created
- `TokensMinted` — Tokens minted (includes new supply)
- `TokensBurned` — Tokens burned (includes new supply)
- `AccountFrozen` — Token account frozen
- `AccountThawed` — Token account thawed
- `OperationsPaused` — Global pause activated
- `OperationsUnpaused` — Global pause deactivated
- `TokensSeized` — Tokens force-transferred
- `RoleGranted` — Role assigned
- `RoleRevoked` — Role removed
- `AuthorityProposed` — Authority transfer initiated
- `AuthorityTransferred` — Authority transfer completed
- `ConfigUpdated` — Config field changed

**sss-transfer-hook events:**
- `BlacklistAdded` — Address blacklisted (includes reason)
- `BlacklistRemoved` — Address removed from blacklist

### Event Listener

The backend runs an event listener that monitors the WebSocket RPC for these events. If `WEBHOOK_URL` is configured, events are forwarded as POST requests.

### Health Monitoring

```bash
# Check backend health
curl http://localhost:3000/health

# Check program accounts
solana account $SSS_MINT --output json
solana account $(sss-token status | grep Config | awk '{print $2}') --output json
```

### Recommended Monitoring Checklist

| Metric | Tool | Frequency |
|---|---|---|
| Total supply drift | `sss-token supply` | Hourly |
| Pause state | `sss-token status` | Continuous |
| Backend health | `GET /health` | Every 30s |
| Blacklist additions | Event listener | Real-time |
| Authority changes | Event listener | Real-time |
| Fee accumulation | `sss-token fees` | Daily |
| Admin count | `sss-token status` | Daily |
