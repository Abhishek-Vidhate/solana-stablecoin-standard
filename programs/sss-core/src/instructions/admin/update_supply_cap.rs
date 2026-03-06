use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::ConfigUpdated;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct UpdateSupplyCap<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [SSS_CONFIG_SEED, config.load()?.mint.as_ref()],
        bump,
    )]
    pub config: AccountLoader<'info, StablecoinConfig>,

    #[account(
        seeds = [
            SSS_ROLE_SEED,
            config.key().as_ref(),
            admin.key().as_ref(),
            &[Role::Admin.as_u8()],
        ],
        bump = admin_role.bump,
    )]
    pub admin_role: Account<'info, RoleAccount>,
}

pub fn handler_update_supply_cap(
    ctx: Context<UpdateSupplyCap>,
    new_supply_cap: Option<u64>,
) -> Result<()> {
    let mut config = ctx.accounts.config.load_mut()?;

    if let Some(cap) = new_supply_cap {
        require!(cap >= config.current_supply(), SssError::InvalidSupplyCap);
        config.has_supply_cap = 1;
        config.supply_cap = cap;
    } else {
        config.has_supply_cap = 0;
        config.supply_cap = 0;
    }

    let config_key = ctx.accounts.config.key();
    drop(config);

    emit!(ConfigUpdated {
        config: config_key,
        field: "supply_cap".to_string(),
        updater: ctx.accounts.admin.key(),
    });

    Ok(())
}
