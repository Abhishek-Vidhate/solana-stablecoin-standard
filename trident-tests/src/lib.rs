#[cfg(test)]
mod arithmetic;
#[cfg(test)]
mod authority_transfer;
#[cfg(test)]
mod fee_invariants;
#[cfg(test)]
mod invariants;
#[cfg(test)]
mod pause_bypass;
#[cfg(test)]
mod role_escalation;
#[cfg(test)]
mod supply_cap;

/// Simulation mirror of `StablecoinConfig` (which is `zero_copy` on-chain and
/// cannot be constructed directly in off-chain tests). Every method here
/// replicates the identical logic from `sss_core::state::StablecoinConfig`.
#[derive(Debug, Clone)]
pub struct SimConfig {
    pub paused: u8,
    pub has_supply_cap: u8,
    pub supply_cap: u64,
    pub total_minted: u64,
    pub total_burned: u64,
    pub admin_count: u16,
    pub transfer_fee_basis_points: u16,
    pub maximum_fee: u64,
    pub has_pending_authority: u8,
}

impl Default for SimConfig {
    fn default() -> Self {
        Self {
            paused: 0,
            has_supply_cap: 0,
            supply_cap: 0,
            total_minted: 0,
            total_burned: 0,
            admin_count: 1,
            transfer_fee_basis_points: 0,
            maximum_fee: 0,
            has_pending_authority: 0,
        }
    }
}

impl SimConfig {
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

    pub fn calculate_fee(&self, amount: u64) -> u64 {
        let fee = (amount as u128)
            .checked_mul(self.transfer_fee_basis_points as u128)
            .unwrap_or(0)
            / 10_000u128;
        let fee = fee as u64;
        if self.maximum_fee > 0 {
            fee.min(self.maximum_fee)
        } else {
            fee
        }
    }
}
