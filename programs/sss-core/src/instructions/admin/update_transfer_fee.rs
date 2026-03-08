use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::constants::*;
use crate::error::SssError;
use crate::events::ConfigUpdated;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct UpdateTransferFee<'info> {
    pub admin: Signer<'info>,

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
            admin.key().as_ref(),
            &[Role::Admin.as_u8()],
        ],
        bump = admin_role.bump,
    )]
    pub admin_role: Account<'info, RoleAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler_update_transfer_fee(
    ctx: Context<UpdateTransferFee>,
    new_basis_points: u16,
    new_maximum_fee: u64,
) -> Result<()> {
    require!(new_basis_points <= 10_000, SssError::InvalidFeeBasisPoints);

    let config = ctx.accounts.config.load()?;
    require!(config.preset == 4, SssError::NotSss4);
    require!(config.mint == ctx.accounts.mint.key(), SssError::MintMismatch);
    let mint_key = ctx.accounts.mint.key();
    let bump = config.bump;
    let old_bps = config.transfer_fee_basis_points;
    let old_max = config.maximum_fee;
    drop(config);

    let signer_seeds: &[&[&[u8]]] = &[&[SSS_CONFIG_SEED, mint_key.as_ref(), &[bump]]];

    let ix = spl_token_2022::extension::transfer_fee::instruction::set_transfer_fee(
        &ctx.accounts.token_program.key(),
        &mint_key,
        &ctx.accounts.config.key(),
        &[],
        new_basis_points,
        new_maximum_fee,
    )?;

    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        signer_seeds,
    )?;

    let mut config = ctx.accounts.config.load_mut()?;
    config.transfer_fee_basis_points = new_basis_points;
    config.maximum_fee = new_maximum_fee;
    let config_key = ctx.accounts.config.key();
    drop(config);

    emit!(ConfigUpdated {
        config: config_key,
        field: "transfer_fee".to_string(),
        old_value: Some(format!("{}bps,{}", old_bps, old_max)),
        new_value: Some(format!("{}bps,{}", new_basis_points, new_maximum_fee)),
        updater: ctx.accounts.admin.key(),
    });

    Ok(())
}
