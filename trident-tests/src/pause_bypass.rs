#[cfg(test)]
mod tests {
    use crate::SimConfig;
    use proptest::prelude::*;

    proptest! {
        /// `is_paused()` is true after setting paused = 1, false after
        /// setting paused = 0, regardless of prior state.
        #[test]
        fn pause_unpause_correctness(initial in 0u8..=1u8) {
            let mut cfg = SimConfig {
                paused: initial,
                ..SimConfig::default()
            };

            cfg.paused = 1;
            assert!(cfg.is_paused(), "must be paused after setting paused = 1");

            cfg.paused = 0;
            assert!(!cfg.is_paused(), "must be unpaused after setting paused = 0");
        }

        /// Double pause: setting paused = 1 when already 1 keeps it 1.
        #[test]
        fn double_pause_idempotent(repeat in 1usize..=10) {
            let mut cfg = SimConfig {
                paused: 1,
                ..SimConfig::default()
            };

            for _ in 0..repeat {
                cfg.paused = 1;
                assert!(cfg.is_paused());
            }
        }

        /// Double unpause: setting paused = 0 when already 0 keeps it 0.
        #[test]
        fn double_unpause_idempotent(repeat in 1usize..=10) {
            let mut cfg = SimConfig {
                paused: 0,
                ..SimConfig::default()
            };

            for _ in 0..repeat {
                cfg.paused = 0;
                assert!(!cfg.is_paused());
            }
        }

        /// Any non-zero value for `paused` is treated as paused.
        #[test]
        fn any_nonzero_is_paused(v in 1u8..=u8::MAX) {
            let cfg = SimConfig {
                paused: v,
                ..SimConfig::default()
            };
            assert!(cfg.is_paused());
        }
    }
}
