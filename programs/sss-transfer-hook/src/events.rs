use anchor_lang::prelude::*;

#[event]
pub struct BlacklistAdded {
    pub mint: Pubkey,
    pub address: Pubkey,
    pub added_by: Pubkey,
    pub added_at: i64,
    pub reason: String,
}

#[event]
pub struct BlacklistRemoved {
    pub mint: Pubkey,
    pub address: Pubkey,
    pub removed_by: Pubkey,
}
