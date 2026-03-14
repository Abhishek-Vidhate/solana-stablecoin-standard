use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Burn, Mint, TokenAccount, TokenInterface};
#[cfg(feature = "cu-profile")]
use anchor_lang::solana_program::log::sol_log_compute_units;

use crate::constants::*;
use crate::error::SssError;
use crate::events::TokensBurned;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub burner: Signer<'info>,

    #[account(
        mut,
        seeds = [SSS_CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub config: AccountLoader<'info, StablecoinConfig>,

    #[account(
        seeds = [
            SSS_ROLE_SEED,
            config.key().as_ref(),
            burner.key().as_ref(),
            &[Role::Burner.as_u8()],
        ],
        bump = burner_role.bump,
    )]
    pub burner_role: Account<'info, RoleAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub from: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler_burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    #[cfg(feature = "cu-profile")]
    sol_log_compute_units();
    require!(amount > 0, SssError::ZeroAmount);

    let config_info = ctx.accounts.config.to_account_info();
    let mint_info = ctx.accounts.mint.to_account_info();
    let from_info = ctx.accounts.from.to_account_info();
    let token_program_info = ctx.accounts.token_program.to_account_info();
    let mint_key = ctx.accounts.mint.key();
    let from_key = ctx.accounts.from.key();
    let from_owner = ctx.accounts.from.owner;
    let burner_key = ctx.accounts.burner.key();

    let mut config = ctx.accounts.config.load_mut()?;
    require!(!config.is_paused(), SssError::Paused);
    require!(config.mint == mint_key, SssError::MintMismatch);

    config.total_burned = config
        .total_burned
        .checked_add(amount)
        .ok_or(SssError::ArithmeticOverflow)?;

    let bump = config.bump;
    let new_supply = config.current_supply();
    drop(config);

    let signer_seeds: &[&[&[u8]]] = &[&[SSS_CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    let cpi_accounts = Burn {
        mint: mint_info,
        from: from_info,
        authority: config_info,
    };
    let cpi_ctx =
        CpiContext::new(token_program_info, cpi_accounts).with_signer(signer_seeds);
    token_interface::burn(cpi_ctx, amount)?;

    emit!(TokensBurned {
        mint: mint_key,
        from: from_key,
        from_owner,
        amount,
        burner: burner_key,
        new_supply,
    });

    Ok(())
}
