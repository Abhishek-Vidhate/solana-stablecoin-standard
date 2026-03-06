pub const SSS_CONFIG_SEED: &[u8] = b"sss-config";
pub const SSS_ROLE_SEED: &[u8] = b"sss-role";

/// StablecoinConfig zero-copy account space: discriminator(8) + struct size.
pub const CONFIG_SPACE: usize = 8 + std::mem::size_of::<crate::state::StablecoinConfig>();

/// RoleAccount space:
/// discriminator(8) + config(32) + address(32) + role(1)
/// + granted_by(32) + granted_at(8) + bump(1)
/// + mint_quota Option<u64>(1+8) + amount_minted(8) = 131
pub const ROLE_SPACE: usize = 131;
