# Trident Fuzz Tests

Fuzz tests for sss-core using [Trident](https://ackee.xyz/trident/) 0.12.

These are **real** Trident tests: they run against TridentSVM with actual BPF programs (`sss_core.so`, `sss_transfer_hook.so`). See [TRIDENT_ASSESSMENT.md](TRIDENT_ASSESSMENT.md) for a detailed honest assessment.

## Running Tests

**From repo root** (trident-tests is in the workspace):

```bash
# Build programs first
anchor build

# Run Trident fuzz (1000 iterations, 100 flows)
cargo run -p fuzz_tests --bin fuzz_0

# Run proptest unit tests (SimConfig simulation logic)
cargo test -p fuzz_tests
```

## Dependency Fixes Applied

The root `Cargo.toml` includes patches for known conflicts:

- **solana-transaction-context**: fuzz_tests forces `2.3.1` (trident-svm needs it; trident-fuzz's solana-sdk pulls 2.3.0)
- **bytemuck_derive**: Root patches to `1.8.1` via git (pyth-solana-receiver-sdk needs <=1.8.1; solana-ed25519-program ^1.8.1 pulls 1.9.0)

## Known Limitations

- **[Trident #385](https://github.com/Ackee-Blockchain/trident/issues/385)**: Trident may not fully support Token-2022 ATAs. The `flow_mint_tokens` test may hit CPI issues when sss-core calls Token-2022.
