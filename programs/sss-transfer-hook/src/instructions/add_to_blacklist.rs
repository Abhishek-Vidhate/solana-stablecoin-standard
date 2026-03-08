use anchor_lang::prelude::*;
#[cfg(feature = "cu-profile")]
use anchor_lang::solana_program::log::sol_log_compute_units;

use crate::constants::*;
use crate::error::TransferHookError;
use crate::events::BlacklistAdded;
use crate::state::BlacklistEntry;

use super::admin_verify::verify_blacklister_for_mint;

#[derive(Accounts)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    /// CHECK: sss-core RoleAccount PDA proving Blacklister role.
    pub blacklister_role: UncheckedAccount<'info>,

    /// CHECK: The stablecoin mint.
    pub mint: UncheckedAccount<'info>,

    /// CHECK: The wallet address to blacklist.
    pub address: UncheckedAccount<'info>,

    #[account(
        init,
        payer = blacklister,
        space = BLACKLIST_SPACE,
        seeds = [BLACKLIST_SEED, mint.key().as_ref(), address.key().as_ref()],
        bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

pub fn handler_add_to_blacklist(ctx: Context<AddToBlacklist>, reason: String) -> Result<()> {
    #[cfg(feature = "cu-profile")]
    sol_log_compute_units();
    require!(reason.len() <= MAX_REASON_LEN, TransferHookError::ReasonTooLong);

    verify_blacklister_for_mint(
        &ctx.accounts.blacklister_role.to_account_info(),
        &ctx.accounts.mint.key(),
        &ctx.accounts.blacklister.key(),
    )?;

    let now = Clock::get()?.unix_timestamp;

    let entry = &mut ctx.accounts.blacklist_entry;
    entry.mint = ctx.accounts.mint.key();
    entry.address = ctx.accounts.address.key();
    entry.added_by = ctx.accounts.blacklister.key();
    entry.added_at = now;
    entry.reason = reason.clone();
    entry.bump = ctx.bumps.blacklist_entry;

    emit!(BlacklistAdded {
        mint: ctx.accounts.mint.key(),
        address: ctx.accounts.address.key(),
        added_by: ctx.accounts.blacklister.key(),
        added_at: now,
        reason,
    });

    Ok(())
}
