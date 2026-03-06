use anchor_lang::prelude::*;

/// Zero-copy config account. Uses `repr(packed)` via `zero_copy(unsafe)` to
/// avoid padding between heterogeneous field types (u8 next to u64).
/// Safe on Solana's BPF/SBF VM which supports unaligned memory access.
#[account(zero_copy(unsafe))]
pub struct StablecoinConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub preset: u8,
    /// 0 = not paused, 1 = paused (u8 for repr(C) compat)
    pub paused: u8,
    /// 0 = no cap, 1 = cap enabled
    pub has_supply_cap: u8,
    pub supply_cap: u64,
    pub total_minted: u64,
    pub total_burned: u64,
    pub bump: u8,
    pub name: [u8; 32],
    pub symbol: [u8; 10],
    pub uri: [u8; 200],
    pub decimals: u8,
    pub enable_permanent_delegate: u8,
    pub enable_transfer_hook: u8,
    pub default_account_frozen: u8,
    pub admin_count: u16,
    /// 0 = no oracle, 1 = oracle configured
    pub has_oracle_feed: u8,
    pub oracle_feed_id: [u8; 32],
    pub transfer_fee_basis_points: u16,
    pub maximum_fee: u64,
    /// 0 = no pending transfer, 1 = pending
    pub has_pending_authority: u8,
    pub pending_authority: Pubkey,
    pub _reserved: [u8; 31],
}

impl StablecoinConfig {
    pub fn is_paused(&self) -> bool {
        self.paused != 0
    }

    pub fn has_cap(&self) -> bool {
        self.has_supply_cap != 0
    }

    pub fn current_supply(&self) -> u64 {
        self.total_minted.saturating_sub(self.total_burned)
    }

    pub fn can_mint(&self, amount: u64) -> bool {
        let new_total = match self.total_minted.checked_add(amount) {
            Some(v) => v,
            None => return false,
        };
        if self.has_cap() {
            let new_supply = new_total.saturating_sub(self.total_burned);
            new_supply <= self.supply_cap
        } else {
            true
        }
    }

    pub fn name_str(&self) -> &str {
        let end = self.name.iter().position(|&b| b == 0).unwrap_or(self.name.len());
        core::str::from_utf8(&self.name[..end]).unwrap_or("")
    }

    pub fn symbol_str(&self) -> &str {
        let end = self.symbol.iter().position(|&b| b == 0).unwrap_or(self.symbol.len());
        core::str::from_utf8(&self.symbol[..end]).unwrap_or("")
    }

    /// Write a UTF-8 string into a fixed-size byte array, zero-padded.
    pub fn set_bytes(dst: &mut [u8], src: &str) {
        let bytes = src.as_bytes();
        let len = bytes.len().min(dst.len());
        dst[..len].copy_from_slice(&bytes[..len]);
        dst[len..].fill(0);
    }
}
