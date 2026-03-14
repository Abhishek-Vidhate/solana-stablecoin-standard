use anchor_lang::prelude::*;

use crate::constants::*;
use crate::events::ConfigUpdated;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct UpdateOracle<'info> {
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

pub fn handler_update_oracle(
    ctx: Context<UpdateOracle>,
    oracle_feed_id: Option<[u8; 32]>,
) -> Result<()> {
    let mut config = ctx.accounts.config.load_mut()?;

    if let Some(feed_id) = oracle_feed_id {
        config.has_oracle_feed = 1;
        config.oracle_feed_id = feed_id;
    } else {
        config.has_oracle_feed = 0;
        config.oracle_feed_id = [0u8; 32];
    }

    let config_key = ctx.accounts.config.key();
    drop(config);

    emit!(ConfigUpdated {
        config: config_key,
        field: "oracle_feed_id".to_string(),
        old_value: None,
        new_value: None,
        updater: ctx.accounts.admin.key(),
    });

    Ok(())
}
