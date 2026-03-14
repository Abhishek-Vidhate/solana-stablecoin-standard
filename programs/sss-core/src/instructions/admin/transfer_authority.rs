use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::{AuthorityProposed, AuthorityTransferred};
use crate::state::{Role, RoleAccount, StablecoinConfig};

// ── Step 1: Propose ─────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ProposeAuthority<'info> {
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

    /// CHECK: The proposed new authority. Validated only by existence—accept_authority
    /// requires this key to sign, proving the recipient controls it.
    pub new_authority: UncheckedAccount<'info>,
}

pub fn handler_propose_authority(ctx: Context<ProposeAuthority>) -> Result<()> {
    let mut config = ctx.accounts.config.load_mut()?;
    config.has_pending_authority = 1;
    config.pending_authority = ctx.accounts.new_authority.key();
    let config_key = ctx.accounts.config.key();
    drop(config);

    emit!(AuthorityProposed {
        config: config_key,
        from: ctx.accounts.admin.key(),
        proposed: ctx.accounts.new_authority.key(),
    });

    Ok(())
}

// ── Step 2: Accept ──────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    #[account(mut)]
    pub new_authority: Signer<'info>,

    /// CHECK: The outgoing admin whose role account will be closed.
    /// Rent is returned to this account.
    #[account(mut)]
    pub old_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [SSS_CONFIG_SEED, config.load()?.mint.as_ref()],
        bump,
    )]
    pub config: AccountLoader<'info, StablecoinConfig>,

    #[account(
        mut,
        close = old_authority,
        seeds = [
            SSS_ROLE_SEED,
            config.key().as_ref(),
            old_authority.key().as_ref(),
            &[Role::Admin.as_u8()],
        ],
        bump = old_admin_role.bump,
        constraint = old_admin_role.address == old_authority.key(),
    )]
    pub old_admin_role: Account<'info, RoleAccount>,

    #[account(
        init,
        payer = new_authority,
        space = ROLE_SPACE,
        seeds = [
            SSS_ROLE_SEED,
            config.key().as_ref(),
            new_authority.key().as_ref(),
            &[Role::Admin.as_u8()],
        ],
        bump,
    )]
    pub new_admin_role: Account<'info, RoleAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler_accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
    let config_data = ctx.accounts.config.load()?;
    require!(
        config_data.has_pending_authority != 0,
        SssError::NoPendingAuthority
    );
    require!(
        config_data.pending_authority == ctx.accounts.new_authority.key(),
        SssError::UnauthorizedAcceptor
    );
    drop(config_data);

    let new_role = &mut ctx.accounts.new_admin_role;
    new_role.config = ctx.accounts.config.key();
    new_role.address = ctx.accounts.new_authority.key();
    new_role.role = Role::Admin;
    new_role.granted_by = ctx.accounts.old_authority.key();
    new_role.granted_at = Clock::get()?.unix_timestamp;
    new_role.bump = ctx.bumps.new_admin_role;
    new_role.mint_quota = None;
    new_role.amount_minted = 0;

    let mut config = ctx.accounts.config.load_mut()?;
    let old_authority = config.authority;
    config.authority = ctx.accounts.new_authority.key();
    config.has_pending_authority = 0;
    config.pending_authority = Pubkey::default();
    let config_key = ctx.accounts.config.key();
    drop(config);

    emit!(AuthorityTransferred {
        config: config_key,
        from: old_authority,
        to: ctx.accounts.new_authority.key(),
    });

    Ok(())
}
