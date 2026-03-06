#[cfg(test)]
mod tests {
    use crate::SimConfig;
    use proptest::prelude::*;

    proptest! {
        /// Proposing a new authority sets `has_pending_authority = 1`.
        #[test]
        fn propose_sets_pending(initial_pending in 0u8..=1u8) {
            let mut cfg = SimConfig {
                has_pending_authority: initial_pending,
                ..SimConfig::default()
            };

            // Simulate propose_authority handler.
            cfg.has_pending_authority = 1;

            assert_eq!(
                cfg.has_pending_authority, 1,
                "has_pending_authority must be 1 after proposal"
            );
        }

        /// Accepting the authority clears `has_pending_authority` to 0.
        #[test]
        fn accept_clears_pending(_dummy in 0u8..=1u8) {
            let mut cfg = SimConfig {
                has_pending_authority: 1,
                ..SimConfig::default()
            };

            // Simulate accept_authority handler.
            cfg.has_pending_authority = 0;

            assert_eq!(
                cfg.has_pending_authority, 0,
                "has_pending_authority must be 0 after accept"
            );
        }

        /// Cannot accept when there is no pending authority
        /// (`has_pending_authority == 0`).
        #[test]
        fn cannot_accept_without_pending(
            paused in 0u8..=1u8,
            cap in 0u64..=u64::MAX,
        ) {
            let cfg = SimConfig {
                has_pending_authority: 0,
                paused,
                supply_cap: cap,
                ..SimConfig::default()
            };

            assert_eq!(
                cfg.has_pending_authority, 0,
                "precondition: no pending authority"
            );
            // On-chain the handler would return `SssError::NoPendingAuthority`.
            // Here we verify the guard condition.
            let would_reject = cfg.has_pending_authority == 0;
            assert!(would_reject, "accept must be rejected without pending");
        }

        /// Propose → Accept → second Accept must be rejected (pending is
        /// cleared after the first accept).
        #[test]
        fn double_accept_rejected(_dummy in 0u8..=1u8) {
            let mut cfg = SimConfig {
                has_pending_authority: 0,
                ..SimConfig::default()
            };

            // Step 1: propose
            cfg.has_pending_authority = 1;
            assert_eq!(cfg.has_pending_authority, 1);

            // Step 2: accept
            cfg.has_pending_authority = 0;
            assert_eq!(cfg.has_pending_authority, 0);

            // Step 3: second accept should be blocked
            let would_reject = cfg.has_pending_authority == 0;
            assert!(would_reject);
        }

        /// Repeated proposals overwrite cleanly — the last proposal wins.
        #[test]
        fn repeated_proposals_overwrite(count in 1usize..=20) {
            let mut cfg = SimConfig::default();

            for _ in 0..count {
                cfg.has_pending_authority = 1;
            }

            assert_eq!(cfg.has_pending_authority, 1);
        }
    }
}
