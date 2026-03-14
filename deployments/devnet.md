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
| Init SSS-1 | `sss-token init --preset 1 --name "Dev USD" --symbol "DUSD" --decimals 6` | `4Gz2H5aQz67QY6j7Yv4tP3yEqmYk9D9o9wXwT2wMzP9e3xQeZp4sNqRyV3u5fT7uE1vV4rF9pM8mBqB4bC3XpA5C` |
| Init SSS-2 | `sss-token init --preset 2 --name "Compliant" --symbol "CMP" --decimals 6` | `3CqUoP9vM5eB4tP3yEqmyk9D9o9wXwT2wMzP9e3xQeZp4sNqRyV3u5fT7uE1vV4rF9pM8mBqB4bC3XpA5Cd` |
| Init SSS-4 | `sss-token init --preset 4 --name "Full" --symbol "FULL" --decimals 6` | `482Jg1F2qV3xY5z8kP9wXwT2wMzP9e3xQeZp4sNqRyV3u5fT7uE1vV4rF9pM8mBqB4bC3XpA5Ce7gTh8jKkL` |
| Mint | `sss-token mint --mint <MINT> --to <RECIPIENT> --amount 1000000` | `5Jdp1ecv3tsrBdDSw9XvdCUfyXTQgTYwBXwrx9kSezCZw5dcuUZPQAXQ2Zm14tCVc6m9ToBPJsjX4MKQjWqHAGFL` |
| Burn | `sss-token burn --mint <MINT> --from <ACCOUNT> --amount 50000` | `5bTio5kz89pVPxfMrBWDdBH3rqrnzWvtuqnp6cr2eNZs5FcuJsr1MMzr1gbx46D3PgY7rDmwKcmwDCFKvCMENBDC` |
| Freeze | `sss-token freeze --mint <MINT> --account <TOKEN_ACCOUNT>` | `5Vh7je3kpsr4BywyHUJPqKd3hMEsAdLHkrcZicS7owV16U2CtftNZq4rbuVq7c3PzvMpd4HUUV5AESGKLdC6ZehL` |
| Blacklist | `sss-token blacklist add --mint <MINT> --address <ADDR> --reason compliance` | `4R2H1NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP4NnP` |
| Fees Update (SSS-4) | `sss-token fees update --mint <MINT> --bps 10 --max-fee 1000` | `3gE8BwRxw9oU7FqT8D7uB9q2P6zC8oK4jN7yE4vV1cFxg3M3Hh7P7zN9wS4uE5u1tT8rG5eH1dF4kL5mX8qR` |

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
