use anchor_lang::prelude::*;
#[cfg(feature = "cu-profile")]
use anchor_lang::solana_program::log::sol_log_compute_units;

use crate::constants::*;
use crate::events::BlacklistRemoved;
use crate::state::BlacklistEntry;

use super::admin_verify::verify_blacklister_for_mint;

#[derive(Accounts)]
pub struct RemoveFromBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    /// CHECK: sss-core RoleAccount PDA proving Blacklister role.
    pub blacklister_role: UncheckedAccount<'info>,

    /// CHECK: The stablecoin mint.
    pub mint: UncheckedAccount<'info>,

    #[account(
        mut,
        close = blacklister,
        seeds = [BLACKLIST_SEED, mint.key().as_ref(), blacklist_entry.address.as_ref()],
        bump = blacklist_entry.bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

pub fn handler_remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
    #[cfg(feature = "cu-profile")]
    sol_log_compute_units();
    let mint_key = ctx.accounts.blacklist_entry.mint;

    verify_blacklister_for_mint(
        &ctx.accounts.blacklister_role.to_account_info(),
        &mint_key,
        &ctx.accounts.blacklister.key(),
    )?;

    emit!(BlacklistRemoved {
        mint: mint_key,
        address: ctx.accounts.blacklist_entry.address,
        removed_by: ctx.accounts.blacklister.key(),
    });

    Ok(())
}
