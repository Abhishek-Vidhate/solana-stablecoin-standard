#[cfg(test)]
mod tests {
    use crate::SimConfig;
    use proptest::prelude::*;

    proptest! {
        /// Minting any u64 amount on top of any existing total_minted must
        /// never panic — `checked_add` returns `None` on overflow and
        /// `can_mint` returns `false`.
        #[test]
        fn mint_burn_overflow_never_panics(
            total_minted in 0u64..=u64::MAX,
            total_burned in 0u64..=u64::MAX,
            amount in 0u64..=u64::MAX,
        ) {
            let cfg = SimConfig {
                total_minted,
                total_burned,
                ..SimConfig::default()
            };

            // Must not panic regardless of inputs.
            let _ = cfg.can_mint(amount);
            let _ = cfg.current_supply();
        }

        /// `checked_add` on u64::MAX with any positive value must return None.
        #[test]
        fn checked_add_u64_max_overflows(amount in 1u64..=u64::MAX) {
            assert!(u64::MAX.checked_add(amount).is_none());
        }

        /// Fee calculation: `basis_points * amount / 10000` must never overflow
        /// when basis_points is within the valid range 0..=10000.
        #[test]
        fn fee_calculation_no_overflow(
            amount in 0u64..=u64::MAX,
            basis_points in 0u16..=10_000u16,
        ) {
            let result = (amount as u128)
                .checked_mul(basis_points as u128)
                .map(|v| v / 10_000u128);
            assert!(result.is_some(), "fee calc overflowed unexpectedly");
            let fee = result.unwrap() as u64;
            assert!(fee <= amount);
        }

        /// `saturating_sub` guarantees the result is always >= 0 (i.e. no
        /// underflow wrapping).
        #[test]
        fn saturating_sub_always_non_negative(
            total_minted in 0u64..=u64::MAX,
            total_burned in 0u64..=u64::MAX,
        ) {
            let supply = total_minted.saturating_sub(total_burned);
            assert!(supply <= total_minted);
        }
    }
}
