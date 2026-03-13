# Compute Unit (CU) & Zero-Copy Optimization Report

This report documents the architectural choices and performance benchmarks achieved in the Solana Stablecoin Standard (SSS) implementation. We prioritize low-latency execution and cost-efficiency through advanced memory management and build-time optimizations.

## 1. Zero-Copy Architecture

The `sss-core` program utilizes Anchor's `zero_copy` deserialization to minimize compute units (CUs) during account reads. This is particularly effective for the `StablecoinConfig` account, which is accessed by every privileged instruction.

### Implementation Details
- **Struct Definition**: `StablecoinConfig` uses `#[account(zero_copy(unsafe))]` paired with `#[repr(packed)]` to ensure a deterministic, padding-free memory layout.
- **Memory Management**: We leverage `AccountLoader<'info, StablecoinConfig>` across all 14+ core instructions. This allows the program to access account data directly in the input buffer without copying it to the heap, bypassing the expensive Borsh deserialization process.
- **Safety**: The `unsafe` variant of zero-copy is utilized knowing the BPF/SBF VM supports unaligned memory access, ensuring compatibility with the packed representation.

### Performance Gains
Traditional `Account<'info, T>` wrappers in Anchor can consume significant CUs for larger structs due to heap allocation and deserialization. For our ~414-byte config, zero-copy reduces reading costs by approximately 50-70% compared to standard Borsh-based deserialization.

---

## 2. Compute Unit Benchmarks

Benchmark data is captured from real Devnet transactions using the `getTransaction().meta.computeUnitsConsumed` metric. These figures represent the total workload, including core program logic, RBAC checks, and CPIs to Token-2022.

| Instruction | Average CU | Assessment |
|-------------|------------|------------|
| `initialize` | 21,831 | Comprehensive setup of Config, Mint, and Extensions. |
| `mint_tokens` | 13,556 | Includes Pyth oracle checks and Token-2022 CPI. |
| `burn_tokens` | 11,121 | Optimized Token-2022 burn CPI. |
| `seize` | 12,770 | High-performance force-transfer via PermanentDelegate. |
| `add_to_blacklist` | 18,378 | State initialization and blacklister verification. |
| `remove_from_blacklist` | 13,653 | Secure account closure and cleanup. |
| `update_transfer_fee` | 12,888 | Atomic configuration update for SSS-4. |

---

## 3. Optimization Techniques

### Instruction Hot-Paths
- **Direct Account Access**: Instructions like `transfer_hook` bypass full deserialization by using `UncheckedAccount` and direct pointer offsets, ensuring the hot transfer path remains exceptionally lean.
- **Minimal RBAC Overhead**: Role verification uses deterministic PDA checks, avoiding expensive cross-program calls where possible.

### Build and Tooling
- **Release Profile**: The workspace `[profile.release]` is configured with `opt-level = 3`, `lto = "fat"`, and `codegen-units = 1` for maximal binary optimization.
- **Profiling Mode**: We maintain a `cu-profile` feature-gate for fine-grained compute unit analysis during development, which is stripped from production builds to avoid telemetry overhead.

## 4. Conclusion

The SSS framework demonstrates that compliance and high-performance are not mutually exclusive on Solana. By utilizing zero-copy deserialization and careful CPI management, we deliver a production-grade stablecoin standard that is both regulatory-compliant and economically viable for high-frequency operations.
