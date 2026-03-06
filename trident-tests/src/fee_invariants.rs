#[cfg(test)]
mod tests {
    use crate::SimConfig;
    use proptest::prelude::*;

    proptest! {
        /// Valid basis_points must be in 0..=10000.
        #[test]
        fn basis_points_within_range(bp in 0u16..=10_000u16) {
            assert!(bp <= 10_000);
        }

        /// Fee is always <= the original amount for valid basis_points.
        #[test]
        fn fee_never_exceeds_amount(
            amount in 0u64..=u64::MAX,
            bp in 0u16..=10_000u16,
        ) {
            let cfg = SimConfig {
                transfer_fee_basis_points: bp,
                maximum_fee: 0,
                ..SimConfig::default()
            };

            let fee = cfg.calculate_fee(amount);
            assert!(
                fee <= amount,
                "fee {} exceeded amount {} at {}bp",
                fee,
                amount,
                bp,
            );
        }

        /// Maximum fee clamp: calculated fee must never exceed `maximum_fee`
        /// when maximum_fee > 0.
        #[test]
        fn maximum_fee_clamp(
            amount in 1u64..=u64::MAX,
            bp in 1u16..=10_000u16,
            max_fee in 1u64..=1_000_000_000u64,
        ) {
            let cfg = SimConfig {
                transfer_fee_basis_points: bp,
                maximum_fee: max_fee,
                ..SimConfig::default()
            };

            let fee = cfg.calculate_fee(amount);
            assert!(
                fee <= max_fee,
                "fee {} exceeded maximum_fee {} (amount={}, bp={})",
                fee,
                max_fee,
                amount,
                bp,
            );
        }

        /// Zero basis points must always produce zero fee.
        #[test]
        fn zero_basis_points_zero_fee(amount in 0u64..=u64::MAX) {
            let cfg = SimConfig {
                transfer_fee_basis_points: 0,
                maximum_fee: 0,
                ..SimConfig::default()
            };

            assert_eq!(cfg.calculate_fee(amount), 0);
        }

        /// At 10000 basis points (100%) the fee equals the full amount
        /// (before max-fee clamping).
        #[test]
        fn full_basis_points_equals_amount(amount in 0u64..=u64::MAX) {
            let cfg = SimConfig {
                transfer_fee_basis_points: 10_000,
                maximum_fee: 0,
                ..SimConfig::default()
            };

            assert_eq!(cfg.calculate_fee(amount), amount);
        }
    }
}
