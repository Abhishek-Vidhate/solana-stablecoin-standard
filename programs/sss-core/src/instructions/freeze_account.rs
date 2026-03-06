use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, FreezeAccount as FreezeAccountCpi, Mint, TokenAccount, TokenInterface,
};

use crate::constants::*;
use crate::error::SssError;
use crate::events::AccountFrozen;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct FreezeTokenAccount<'info> {
    pub freezer: Signer<'info>,

    #[account(
        seeds = [SSS_CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub config: AccountLoader<'info, StablecoinConfig>,

    #[account(
        seeds = [
            SSS_ROLE_SEED,
            config.key().as_ref(),
            freezer.key().as_ref(),
            &[Role::Freezer.as_u8()],
        ],
        bump = freezer_role.bump,
    )]
    pub freezer_role: Account<'info, RoleAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler_freeze_account(ctx: Context<FreezeTokenAccount>) -> Result<()> {
    let config = ctx.accounts.config.load()?;
    require!(!config.is_paused(), SssError::Paused);
    require!(config.mint == ctx.accounts.mint.key(), SssError::MintMismatch);

    let mint_key = ctx.accounts.mint.key();
    let bump = config.bump;
    drop(config);

    let signer_seeds: &[&[&[u8]]] = &[&[SSS_CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    let cpi_accounts = FreezeAccountCpi {
        account: ctx.accounts.token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
        .with_signer(signer_seeds);
    token_interface::freeze_account(cpi_ctx)?;

    emit!(AccountFrozen {
        mint: mint_key,
        account: ctx.accounts.token_account.key(),
        freezer: ctx.accounts.freezer.key(),
    });

    Ok(())
}
