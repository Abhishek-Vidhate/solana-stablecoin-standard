# Devnet Deployment Proof

## Programs

| Program | Program ID | Deploy Signature |
|---------|-----------|-----------------|
| sss-core | `CoREsjH41J3KezywbudJC4gHqCE1QhNWaXRbC1QjA9ei` | `4TKKVhTm3jEr6utw9GKth2sJtYnceXr3oRWHYuQ9Y3ueFcdSNYscaNGknTe9zDjCw7HWPavmZ8wpPQrxMJKPKfv6` |
| sss-transfer-hook | `HooKchDVVKm7GkAX4w75bbaQUbMcDUnYXSzqLZCWKCDH` | `5zGhT86jFKcgw9iWZKTmg3jSwWuMYXoreRQPgxZZADQmXetYHkEV6iJkQVviCiEFWr1f1rhNM3YGSR9PtXZH5sQi` |

## Deployment Details

- **Network:** Devnet (`https://api.devnet.solana.com`)
- **Upgrade Authority:** Deployer wallet
- **Anchor Version:** 0.31.1
- **Date:** 2026-03-07

## Explorer Links

- [sss-core on Solana Explorer](https://explorer.solana.com/address/CoREsjH41J3KezywbudJC4gHqCE1QhNWaXRbC1QjA9ei?cluster=devnet)
- [sss-transfer-hook on Solana Explorer](https://explorer.solana.com/address/HooKchDVVKm7GkAX4w75bbaQUbMcDUnYXSzqLZCWKCDH?cluster=devnet)

## Transaction Signatures (Devnet Proof)

Run the CLI on devnet and paste signatures below:

| Action | Command | Signature |
|--------|---------|-----------|
| Init SSS-1 | `sss-token init --preset 1 --name "Dev USD" --symbol "DUSD" --decimals 6` | |
| Init SSS-2 | `sss-token init --preset 2 --name "Compliant" --symbol "CMP" --decimals 6` | |
| Init SSS-4 | `sss-token init --preset 4 --name "Full" --symbol "FULL" --decimals 6` | |
| Mint | `sss-token mint --mint <MINT> --to <RECIPIENT> --amount 1000000` | |
| Burn | `sss-token burn --mint <MINT> --from <ACCOUNT> --amount 500000` | |
| Freeze | `sss-token freeze --mint <MINT> --account <TOKEN_ACCOUNT>` | |
| Blacklist | `sss-token blacklist add --mint <MINT> --address <ADDR> --reason compliance` | |
| Fees Update (SSS-4) | `sss-token fees update --mint <MINT> --bps 10 --max-fee 1000` | |

Example commands:

```bash
# Initialize SSS-1
sss-token init --preset 1 --name "Dev USD" --symbol "DUSD" --decimals 6

# Mint
sss-token mint --mint <MINT_PUBKEY> --to <RECIPIENT> --amount 1000000

# Burn
sss-token burn --mint <MINT_PUBKEY> --from <TOKEN_ACCOUNT> --amount 500000

# Freeze
sss-token freeze --mint <MINT> --account <TOKEN_ACCOUNT>

# Blacklist (SSS-2/4)
sss-token blacklist add --mint <MINT> --address <ADDR> --reason compliance

# SSS-4 fee update
sss-token fees update --mint <MINT> --bps 10 --max-fee 1000
```

Capture transaction signatures from the CLI output or Solana Explorer for submission proof.
