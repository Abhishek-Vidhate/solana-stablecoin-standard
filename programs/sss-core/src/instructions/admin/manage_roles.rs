use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::{RoleGranted, RoleRevoked};
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct GrantRole<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

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
            admin.key().as_ref(),
            &[Role::Admin.as_u8()],
        ],
        bump = admin_role.bump,
    )]
    pub admin_role: Account<'info, RoleAccount>,

    /// CHECK: Any valid public key can be granted a role.
    pub grantee: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = ROLE_SPACE,
        seeds = [
            SSS_ROLE_SEED,
            config.key().as_ref(),
            grantee.key().as_ref(),
            &[role],
        ],
        bump,
    )]
    pub role_account: Account<'info, RoleAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler_grant(ctx: Context<GrantRole>, role: u8) -> Result<()> {
    let role_enum = Role::from_u8(role).ok_or(SssError::InvalidRole)?;

    if role_enum == Role::Admin {
        let mut config = ctx.accounts.config.load_mut()?;
        config.admin_count = config
            .admin_count
            .checked_add(1)
            .ok_or(SssError::ArithmeticOverflow)?;
        drop(config);
    }

    let role_account = &mut ctx.accounts.role_account;
    role_account.config = ctx.accounts.config.key();
    role_account.address = ctx.accounts.grantee.key();
    role_account.role = role_enum;
    role_account.granted_by = ctx.accounts.admin.key();
    role_account.granted_at = Clock::get()?.unix_timestamp;
    role_account.bump = ctx.bumps.role_account;
    role_account.mint_quota = None;
    role_account.amount_minted = 0;

    emit!(RoleGranted {
        config: ctx.accounts.config.key(),
        address: ctx.accounts.grantee.key(),
        role,
        granted_by: ctx.accounts.admin.key(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RevokeRole<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

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
            admin.key().as_ref(),
            &[Role::Admin.as_u8()],
        ],
        bump = admin_role.bump,
    )]
    pub admin_role: Account<'info, RoleAccount>,

    #[account(
        mut,
        close = admin,
        constraint = role_account.config == config.key(),
    )]
    pub role_account: Account<'info, RoleAccount>,
}

pub fn handler_revoke(ctx: Context<RevokeRole>) -> Result<()> {
    let role_account = &ctx.accounts.role_account;

    if role_account.role == Role::Admin {
        let mut config = ctx.accounts.config.load_mut()?;
        require!(config.admin_count > 1, SssError::LastAdmin);
        config.admin_count = config.admin_count.saturating_sub(1);
        drop(config);
    }

    emit!(RoleRevoked {
        config: ctx.accounts.config.key(),
        address: role_account.address,
        role: role_account.role.as_u8(),
        revoked_by: ctx.accounts.admin.key(),
    });

    Ok(())
}
