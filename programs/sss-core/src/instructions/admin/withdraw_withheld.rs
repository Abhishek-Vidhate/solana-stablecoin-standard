use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::SssError;
use crate::events::ConfigUpdated;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct WithdrawWithheld<'info> {
    pub admin: Signer<'info>,

    #[account(
        seeds = [SSS_CONFIG_SEED, mint.key().as_ref()],
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

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The destination token account to receive collected fees.
    #[account(
        mut,
        token::mint = mint,
    )]
    pub fee_destination: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

/// Withdraw accumulated transfer fees from token accounts. The caller passes
/// the source token accounts holding withheld fees via remaining_accounts.
pub fn handler_withdraw_withheld<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawWithheld<'info>>,
) -> Result<()> {
    let config = ctx.accounts.config.load()?;
    require!(config.preset == 4, SssError::NotSss4);
    require!(config.mint == ctx.accounts.mint.key(), SssError::MintMismatch);
    let mint_key = ctx.accounts.mint.key();
    let bump = config.bump;
    drop(config);

    let signer_seeds: &[&[&[u8]]] = &[&[SSS_CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    let source_accounts: Vec<&Pubkey> = ctx
        .remaining_accounts
        .iter()
        .map(|a| a.key)
        .collect();

    let ix = spl_token_2022::extension::transfer_fee::instruction::withdraw_withheld_tokens_from_accounts(
        &ctx.accounts.token_program.key(),
        &mint_key,
        &ctx.accounts.fee_destination.key(),
        &ctx.accounts.config.key(),
        &[],
        &source_accounts,
    )?;

    let mut account_infos = vec![
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.fee_destination.to_account_info(),
        ctx.accounts.config.to_account_info(),
    ];
    for remaining in ctx.remaining_accounts {
        account_infos.push(remaining.clone());
    }

    anchor_lang::solana_program::program::invoke_signed(&ix, &account_infos, signer_seeds)?;

    emit!(ConfigUpdated {
        config: ctx.accounts.config.key(),
        field: "withdraw_withheld".to_string(),
        updater: ctx.accounts.admin.key(),
    });

    Ok(())
}
