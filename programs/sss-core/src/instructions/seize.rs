use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::error::SssError;
use crate::events::TokensSeized;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct Seize<'info> {
    pub seizer: Signer<'info>,

    /// NO pause check -- seizure works during emergencies.
    #[account(
        seeds = [SSS_CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub config: AccountLoader<'info, StablecoinConfig>,

    #[account(
        seeds = [
            SSS_ROLE_SEED,
            config.key().as_ref(),
            seizer.key().as_ref(),
            &[Role::Seizer.as_u8()],
        ],
        bump = seizer_role.bump,
    )]
    pub seizer_role: Account<'info, RoleAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub from: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub to: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

/// Seize tokens via the permanent delegate. For SSS-2/SSS-4 mints with transfer
/// hooks, the caller MUST pass the hook program and blacklist PDAs via
/// remaining_accounts so Token-2022 can CPI into the hook during the transfer.
pub fn handler_seize<'info>(
    ctx: Context<'_, '_, '_, 'info, Seize<'info>>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, SssError::ZeroAmount);

    let config = ctx.accounts.config.load()?;
    require!(config.mint == ctx.accounts.mint.key(), SssError::MintMismatch);

    let mint_key = ctx.accounts.mint.key();
    let decimals = ctx.accounts.mint.decimals;
    let bump = config.bump;
    drop(config);

    let signer_seeds: &[&[&[u8]]] = &[&[SSS_CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    let remaining: Vec<AccountInfo<'info>> = ctx.remaining_accounts.to_vec();

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.from.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.to.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
    };
    let mut cpi_ctx =
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
            .with_signer(signer_seeds);

    if !remaining.is_empty() {
        cpi_ctx = cpi_ctx.with_remaining_accounts(remaining);
    }

    token_interface::transfer_checked(cpi_ctx, amount, decimals)?;

    emit!(TokensSeized {
        mint: mint_key,
        from: ctx.accounts.from.key(),
        to: ctx.accounts.to.key(),
        amount,
        seizer: ctx.accounts.seizer.key(),
    });

    Ok(())
}
