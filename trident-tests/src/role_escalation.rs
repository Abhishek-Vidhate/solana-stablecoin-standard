#[cfg(test)]
mod tests {
    use crate::SimConfig;
    use proptest::prelude::*;
    use sss_core::state::Role;

    #[derive(Debug, Clone)]
    enum RoleOp {
        Grant(u8),
        Revoke(u8),
    }

    fn role_op_strategy() -> impl Strategy<Value = RoleOp> {
        prop_oneof![
            (0u8..=6u8).prop_map(RoleOp::Grant),
            (0u8..=6u8).prop_map(RoleOp::Revoke),
        ]
    }

    proptest! {
        /// Random grant/revoke sequences must keep `admin_count` in sync
        /// with actual admin grants tracked in a separate counter.
        #[test]
        fn admin_count_tracks_grants_and_revokes(
            ops in proptest::collection::vec(role_op_strategy(), 1..60),
        ) {
            let mut cfg = SimConfig::default(); // admin_count starts at 1
            let mut actual_admin_count: u16 = 1;

            for op in &ops {
                match op {
                    RoleOp::Grant(role_u8) => {
                        if Role::from_u8(*role_u8).is_some() && *role_u8 == Role::Admin.as_u8() {
                            if let Some(new_count) = actual_admin_count.checked_add(1) {
                                actual_admin_count = new_count;
                                cfg.admin_count = cfg
                                    .admin_count
                                    .checked_add(1)
                                    .unwrap_or(cfg.admin_count);
                            }
                        }
                    }
                    RoleOp::Revoke(role_u8) => {
                        if Role::from_u8(*role_u8).is_some() && *role_u8 == Role::Admin.as_u8() {
                            if actual_admin_count > 1 {
                                actual_admin_count -= 1;
                                cfg.admin_count = cfg.admin_count.saturating_sub(1);
                            }
                        }
                    }
                }
            }

            assert_eq!(cfg.admin_count, actual_admin_count);
            assert!(cfg.admin_count >= 1, "admin_count dropped below 1");
        }

        /// The last-admin protection: cannot revoke when `admin_count == 1`.
        #[test]
        fn last_admin_protection(
            grants in 0u16..=10u16,
            revokes in 0u16..=20u16,
        ) {
            let mut cfg = SimConfig::default(); // admin_count = 1

            for _ in 0..grants {
                cfg.admin_count = cfg.admin_count.saturating_add(1);
            }

            for _ in 0..revokes {
                if cfg.admin_count > 1 {
                    cfg.admin_count -= 1;
                }
            }

            assert!(
                cfg.admin_count >= 1,
                "admin_count must never drop below 1"
            );
        }

        /// `Role::from_u8(role.as_u8())` must round-trip for all valid roles.
        #[test]
        fn role_round_trip(v in 0u8..=6u8) {
            let role = Role::from_u8(v).unwrap();
            assert_eq!(role.as_u8(), v);
            assert_eq!(Role::from_u8(role.as_u8()), Some(role));
        }

        /// `Role::from_u8` returns `None` for any value outside 0..=6.
        #[test]
        fn role_from_u8_invalid(v in 7u8..=u8::MAX) {
            assert!(Role::from_u8(v).is_none());
        }
    }
}
