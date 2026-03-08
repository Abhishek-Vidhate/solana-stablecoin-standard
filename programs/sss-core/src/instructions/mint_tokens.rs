//! Mint tokens instruction. Uses Pyth PriceUpdateV2 when config.has_oracle_feed is set.
//! FUTURE: Switchboard V2 — add oracle_type in config and CPI to Switchboard feed when configured.

use anchor_lang::prelude::*;
#[cfg(feature = "cu-profile")]
use anchor_lang::solana_program::log::sol_log_compute_units;
use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::constants::*;
use crate::error::SssError;
use crate::events::TokensMinted;
use crate::state::{Role, RoleAccount, StablecoinConfig};

/// Maximum age of price update in seconds (2 minutes).
const ORACLE_MAX_AGE_SECS: u64 = 120;

#[derive(Accounts)]
pub struct MintTokens<'info> {
    pub minter: Signer<'info>,

    #[account(
        mut,
        seeds = [SSS_CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub config: AccountLoader<'info, StablecoinConfig>,

    #[account(
        mut,
        seeds = [
            SSS_ROLE_SEED,
            config.key().as_ref(),
            minter.key().as_ref(),
            &[Role::Minter.as_u8()],
        ],
        bump = minter_role.bump,
    )]
    pub minter_role: Account<'info, RoleAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub to: InterfaceAccount<'info, TokenAccount>,

    /// Pyth PriceUpdateV2 account. Required when config.has_oracle_feed is set.
    pub price_update: Option<Account<'info, PriceUpdateV2>>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler_mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    #[cfg(feature = "cu-profile")]
    sol_log_compute_units();
    require!(amount > 0, SssError::ZeroAmount);

    let minter_role = &mut ctx.accounts.minter_role;
    if let Some(quota) = minter_role.mint_quota {
        let new_total = minter_role
            .amount_minted
            .checked_add(amount)
            .ok_or(SssError::ArithmeticOverflow)?;
        require!(new_total <= quota, SssError::QuotaExceeded);
    }

    let config_info = ctx.accounts.config.to_account_info();
    let mint_info = ctx.accounts.mint.to_account_info();
    let to_info = ctx.accounts.to.to_account_info();
    let token_program_info = ctx.accounts.token_program.to_account_info();
    let mint_key = ctx.accounts.mint.key();
    let to_key = ctx.accounts.to.key();
    let minter_key = ctx.accounts.minter.key();

    let mut config = ctx.accounts.config.load_mut()?;
    require!(!config.is_paused(), SssError::Paused);
    require!(config.mint == mint_key, SssError::MintMismatch);

    if config.has_oracle_feed != 0 {
        let price_update = ctx
            .accounts
            .price_update
            .as_ref()
            .ok_or(SssError::PriceUpdateRequired)?;
        let feed_id_hex = format!("0x{}", hex::encode(config.oracle_feed_id));
        let feed_id = get_feed_id_from_hex(&feed_id_hex).map_err(|_| SssError::OracleFeedIdMismatch)?;
        let clock = Clock::get()?;
        let price = price_update
            .get_price_no_older_than(&clock, ORACLE_MAX_AGE_SECS, &feed_id)
            .map_err(|_| SssError::PriceTooOld)?;
        require!(price.price > 0, SssError::PriceTooOld);
        if config.has_cap() {
            let decimals = config.decimals as u32;
            let new_supply = config
                .total_minted
                .checked_add(amount)
                .ok_or(SssError::ArithmeticOverflow)?
                .saturating_sub(config.total_burned);
            let price_val = price.price as u64;
            let exp = price.exponent;
            let token_cap = if exp >= 0 {
                let divisor = price_val
                    .checked_mul(10u64.pow(exp as u32))
                    .ok_or(SssError::ArithmeticOverflow)?;
                (config.supply_cap as u128)
                    .checked_mul(10u128.pow(decimals))
                    .and_then(|n| n.checked_div(divisor as u128))
                    .and_then(|n| u64::try_from(n).ok())
                    .ok_or(SssError::ArithmeticOverflow)?
            } else {
                let mult = 10u128.pow((-exp) as u32);
                let numerator = (config.supply_cap as u128)
                    .checked_mul(10u128.pow(decimals))
                    .and_then(|n| n.checked_mul(mult))
                    .ok_or(SssError::ArithmeticOverflow)?;
                let divisor = price_val as u128;
                u64::try_from(numerator.checked_div(divisor).ok_or(SssError::ArithmeticOverflow)?)
                    .map_err(|_| SssError::ArithmeticOverflow)?
            };
            require!(new_supply <= token_cap, SssError::SupplyCapExceeded);
        }
    } else {
        require!(config.can_mint(amount), SssError::SupplyCapExceeded);
    }

    config.total_minted = config
        .total_minted
        .checked_add(amount)
        .ok_or(SssError::ArithmeticOverflow)?;

    let bump = config.bump;
    let new_supply = config.current_supply();
    drop(config);

    let signer_seeds: &[&[&[u8]]] = &[&[SSS_CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    let cpi_accounts = MintTo {
        mint: mint_info,
        to: to_info,
        authority: config_info,
    };
    let cpi_ctx =
        CpiContext::new(token_program_info, cpi_accounts).with_signer(signer_seeds);
    token_interface::mint_to(cpi_ctx, amount)?;

    ctx.accounts.minter_role.amount_minted = ctx
        .accounts
        .minter_role
        .amount_minted
        .checked_add(amount)
        .ok_or(SssError::ArithmeticOverflow)?;

    emit!(TokensMinted {
        mint: mint_key,
        to: to_key,
        amount,
        minter: minter_key,
        new_supply,
    });

    Ok(())
}
