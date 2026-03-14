#![allow(deprecated)]
use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("CoREe6ZkRj5QFA96vYWPqtEfbL1Cnjr1b1BsEymuAt3x");

#[program]
pub mod sss_core {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        instructions::initialize::handler_initialize(ctx, args)
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint_tokens::handler_mint_tokens(ctx, amount)
    }

    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn_tokens::handler_burn_tokens(ctx, amount)
    }

    pub fn freeze_account(ctx: Context<FreezeTokenAccount>) -> Result<()> {
        instructions::freeze_account::handler_freeze_account(ctx)
    }

    pub fn thaw_account(ctx: Context<ThawTokenAccount>) -> Result<()> {
        instructions::thaw_account::handler_thaw_account(ctx)
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        instructions::pause::handler_pause(ctx)
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        instructions::unpause::handler_unpause(ctx)
    }

    pub fn seize<'info>(
        ctx: Context<'_, '_, '_, 'info, Seize<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::seize::handler_seize(ctx, amount)
    }

    pub fn grant_role(ctx: Context<GrantRole>, role: u8) -> Result<()> {
        instructions::admin::manage_roles::handler_grant(ctx, role)
    }

    pub fn revoke_role(ctx: Context<RevokeRole>) -> Result<()> {
        instructions::admin::manage_roles::handler_revoke(ctx)
    }

    pub fn propose_authority(ctx: Context<ProposeAuthority>) -> Result<()> {
        instructions::admin::transfer_authority::handler_propose_authority(ctx)
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::admin::transfer_authority::handler_accept_authority(ctx)
    }

    pub fn update_supply_cap(
        ctx: Context<UpdateSupplyCap>,
        new_supply_cap: Option<u64>,
    ) -> Result<()> {
        instructions::admin::update_supply_cap::handler_update_supply_cap(ctx, new_supply_cap)
    }

    pub fn update_minter(ctx: Context<UpdateMinter>, new_quota: Option<u64>) -> Result<()> {
        instructions::admin::update_minter::handler_update_minter(ctx, new_quota)
    }

    pub fn update_oracle(
        ctx: Context<UpdateOracle>,
        oracle_feed_id: Option<[u8; 32]>,
    ) -> Result<()> {
        instructions::admin::update_oracle::handler_update_oracle(ctx, oracle_feed_id)
    }

    pub fn update_transfer_fee(
        ctx: Context<UpdateTransferFee>,
        new_basis_points: u16,
        new_maximum_fee: u64,
    ) -> Result<()> {
        instructions::admin::update_transfer_fee::handler_update_transfer_fee(
            ctx,
            new_basis_points,
            new_maximum_fee,
        )
    }

    pub fn withdraw_withheld<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawWithheld<'info>>,
    ) -> Result<()> {
        instructions::admin::withdraw_withheld::handler_withdraw_withheld(ctx)
    }
}
