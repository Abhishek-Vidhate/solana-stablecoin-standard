use anchor_lang::prelude::*;

#[account]
pub struct BlacklistEntry {
    pub mint: Pubkey,
    pub address: Pubkey,
    pub added_by: Pubkey,
    pub added_at: i64,
    /// Compliance reason (max 128 chars). Use reference codes only, no PII.
    pub reason: String,
    pub bump: u8,
}
