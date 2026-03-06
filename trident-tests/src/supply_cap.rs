#[cfg(test)]
mod tests {
    use crate::SimConfig;
    use proptest::prelude::*;

    proptest! {
        /// `can_mint(amount)` must return false when the mint would push
        /// `current_supply` above the cap.
        #[test]
        fn can_mint_false_when_exceeding_cap(
            cap in 1u64..=1_000_000u64,
            existing in 0u64..=1_000_000u64,
            extra in 1u64..=1_000_000u64,
        ) {
            let total_minted = existing.min(cap);
            let cfg = SimConfig {
                has_supply_cap: 1,
                supply_cap: cap,
                total_minted,
                total_burned: 0,
                ..SimConfig::default()
            };

            let remaining = cap.saturating_sub(total_minted);
            if extra > remaining {
                assert!(
                    !cfg.can_mint(extra),
                    "can_mint should be false: supply={}, cap={}, extra={}",
                    cfg.current_supply(),
                    cap,
                    extra,
                );
            }
        }

        /// Random mint sequences with a cap: total supply must never exceed
        /// the cap.
        #[test]
        fn random_mint_sequences_respect_cap(
            cap in 1_000u64..=5_000_000u64,
            amounts in proptest::collection::vec(1u64..=1_000_000u64, 1..40),
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

            assert!(
                cfg.current_supply() <= cap,
                "supply {} exceeded cap {}",
                cfg.current_supply(),
                cap,
            );
        }

        /// No overflow when supply_cap is u64::MAX.
        #[test]
        fn no_overflow_with_max_cap(
            amount in 0u64..=u64::MAX,
            total_minted in 0u64..=u64::MAX,
        ) {
            let cfg = SimConfig {
                has_supply_cap: 1,
                supply_cap: u64::MAX,
                total_minted,
                total_burned: 0,
                ..SimConfig::default()
            };

            // Must not panic.
            let result = cfg.can_mint(amount);

            // If checked_add overflows, can_mint returns false.
            if total_minted.checked_add(amount).is_none() {
                assert!(!result);
            }
        }

        /// `can_mint(0)` should always return true (adding zero never exceeds
        /// anything and checked_add(0) never overflows).
        #[test]
        fn can_mint_zero_always_true(
            cap in 0u64..=u64::MAX,
            total_minted in 0u64..=u64::MAX,
            total_burned in 0u64..=u64::MAX,
            has_cap in 0u8..=1u8,
        ) {
            let cfg = SimConfig {
                has_supply_cap: has_cap,
                supply_cap: cap,
                total_minted,
                total_burned,
                ..SimConfig::default()
            };

            // Minting zero should succeed unless total_minted + 0 somehow
            // exceeds cap, which can only happen when total_minted > cap and
            // total_burned == 0 and has_cap == 1.
            let result = cfg.can_mint(0);

            if has_cap == 0 {
                assert!(result, "no cap → can_mint(0) must be true");
            } else {
                let effective_supply = total_minted.saturating_sub(total_burned);
                assert_eq!(result, effective_supply <= cap);
            }
        }
    }
}
