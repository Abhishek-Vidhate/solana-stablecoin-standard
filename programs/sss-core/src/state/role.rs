use anchor_lang::prelude::*;

#[account]
pub struct RoleAccount {
    pub config: Pubkey,
    pub address: Pubkey,
    pub role: Role,
    pub granted_by: Pubkey,
    pub granted_at: i64,
    pub bump: u8,
    /// Per-minter quota: maximum tokens this minter may mint. None = unlimited.
    pub mint_quota: Option<u64>,
    /// Cumulative amount minted by this minter.
    pub amount_minted: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Admin,
    Minter,
    Freezer,
    Pauser,
    Burner,
    Blacklister,
    Seizer,
}

impl Role {
    pub fn as_u8(&self) -> u8 {
        match self {
            Role::Admin => 0,
            Role::Minter => 1,
            Role::Freezer => 2,
            Role::Pauser => 3,
            Role::Burner => 4,
            Role::Blacklister => 5,
            Role::Seizer => 6,
        }
    }

    pub fn from_u8(v: u8) -> Option<Role> {
        match v {
            0 => Some(Role::Admin),
            1 => Some(Role::Minter),
            2 => Some(Role::Freezer),
            3 => Some(Role::Pauser),
            4 => Some(Role::Burner),
            5 => Some(Role::Blacklister),
            6 => Some(Role::Seizer),
            _ => None,
        }
    }
}
