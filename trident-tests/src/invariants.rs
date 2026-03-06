#[cfg(test)]
mod tests {
    use crate::SimConfig;
    use proptest::prelude::*;

    /// Describes a single operation in a mint/burn sequence.
    #[derive(Debug, Clone)]
    enum Op {
        Mint(u64),
        Burn(u64),
    }

    fn op_strategy() -> impl Strategy<Value = Op> {
        prop_oneof![
            (1u64..=1_000_000u64).prop_map(Op::Mint),
            (1u64..=1_000_000u64).prop_map(Op::Burn),
        ]
    }

    proptest! {
        /// After any sequence of mints and burns the invariant
        /// `total_minted - total_burned == current_supply()` must hold.
        #[test]
        fn supply_invariant_after_operations(
            ops in proptest::collection::vec(op_strategy(), 1..50),
        ) {
            let mut cfg = SimConfig::default();

            for op in &ops {
                match op {
                    Op::Mint(amount) => {
                        if let Some(new_total) = cfg.total_minted.checked_add(*amount) {
                            cfg.total_minted = new_total;
                        }
                    }
                    Op::Burn(amount) => {
                        let effective = (*amount).min(cfg.current_supply());
                        if effective > 0 {
                            cfg.total_burned = cfg
                                .total_burned
                                .checked_add(effective)
                                .unwrap_or(cfg.total_burned);
                        }
                    }
                }
            }

            let expected = cfg.total_minted.saturating_sub(cfg.total_burned);
            assert_eq!(cfg.current_supply(), expected);
        }

        /// With a supply cap enabled, random mint/burn sequences must never
        /// push `current_supply()` above `supply_cap`.
        #[test]
        fn supply_cap_never_exceeded(
            cap in 1_000u64..=10_000_000u64,
            ops in proptest::collection::vec(op_strategy(), 1..50),
        ) {
            let mut cfg = SimConfig {
                has_supply_cap: 1,
                supply_cap: cap,
                ..SimConfig::default()
            };

            for op in &ops {
                match op {
                    Op::Mint(amount) => {
                        if cfg.can_mint(*amount) {
                            cfg.total_minted = cfg
                                .total_minted
                                .checked_add(*amount)
                                .unwrap_or(cfg.total_minted);
                        }
                    }
                    Op::Burn(amount) => {
                        let effective = (*amount).min(cfg.current_supply());
                        if effective > 0 {
                            cfg.total_burned = cfg
                                .total_burned
                                .checked_add(effective)
                                .unwrap_or(cfg.total_burned);
                        }
                    }
                }
            }

            assert!(
                cfg.current_supply() <= cap,
                "supply {} exceeded cap {}",
                cfg.current_supply(),
                cap
            );
        }

        /// Burn can never exceed total_minted when we only burn up to
        /// the current supply.
        #[test]
        fn burn_never_exceeds_total_minted(
            mints in proptest::collection::vec(1u64..=500_000u64, 1..20),
            burns in proptest::collection::vec(1u64..=500_000u64, 1..20),
        ) {
            let mut cfg = SimConfig::default();

            for m in &mints {
                if let Some(new_total) = cfg.total_minted.checked_add(*m) {
                    cfg.total_minted = new_total;
                }
            }

            for b in &burns {
                let effective = (*b).min(cfg.current_supply());
                if effective > 0 {
                    cfg.total_burned = cfg
                        .total_burned
                        .checked_add(effective)
                        .unwrap_or(cfg.total_burned);
                }
            }

            assert!(cfg.total_burned <= cfg.total_minted);
        }

        /// When a cap is set, `current_supply()` is always <= supply_cap
        /// after any gated minting.
        #[test]
        fn current_supply_within_cap(
            cap in 100u64..=1_000_000u64,
            amounts in proptest::collection::vec(1u64..=500_000u64, 1..30),
        ) {
            let mut cfg = SimConfig {
                has_supply_cap: 1,
                supply_cap: cap,
                ..SimConfig::default()
            };

            for amount in &amounts {
                if cfg.can_mint(*amount) {
                    cfg.total_minted = cfg
                        .total_minted
                        .checked_add(*amount)
                        .unwrap_or(cfg.total_minted);
                }
            }

            assert!(cfg.current_supply() <= cfg.supply_cap);
        }
    }
}
