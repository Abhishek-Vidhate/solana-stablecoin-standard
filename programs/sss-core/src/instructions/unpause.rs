use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::OperationsUnpaused;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct Unpause<'info> {
    pub pauser: Signer<'info>,

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
            pauser.key().as_ref(),
            &[Role::Pauser.as_u8()],
        ],
        bump = pauser_role.bump,
    )]
    pub pauser_role: Account<'info, RoleAccount>,
}

pub fn handler_unpause(ctx: Context<Unpause>) -> Result<()> {
    let mut config = ctx.accounts.config.load_mut()?;
    require!(config.is_paused(), SssError::NotPaused);
    config.paused = 0;
    let mint = config.mint;
    drop(config);

    emit!(OperationsUnpaused {
        mint,
        pauser: ctx.accounts.pauser.key(),
    });

    Ok(())
}
