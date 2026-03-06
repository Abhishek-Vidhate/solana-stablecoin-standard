use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::constants::*;
use crate::error::SssError;
use crate::events::StablecoinInitialized;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeArgs {
    pub preset: u8,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub supply_cap: Option<u64>,
    pub enable_permanent_delegate: Option<bool>,
    pub enable_transfer_hook: Option<bool>,
    pub default_account_frozen: Option<bool>,
    pub oracle_feed_id: Option<[u8; 32]>,
    /// SSS-4: initial transfer fee in basis points (0-10000).
    pub transfer_fee_basis_points: Option<u16>,
    /// SSS-4: maximum fee per transfer in token base units.
    pub maximum_fee: Option<u64>,
}

#[derive(Accounts)]
#[instruction(args: InitializeArgs)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = CONFIG_SPACE,
        seeds = [SSS_CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub config: AccountLoader<'info, StablecoinConfig>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = ROLE_SPACE,
        seeds = [
            SSS_ROLE_SEED,
            config.key().as_ref(),
            authority.key().as_ref(),
            &[Role::Admin.as_u8()],
        ],
        bump,
    )]
    pub admin_role: Account<'info, RoleAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler_initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
    require!(args.preset >= 1 && args.preset <= 4, SssError::InvalidPreset);
    require!(args.name.len() <= 32, SssError::NameTooLong);
    require!(args.symbol.len() <= 10, SssError::SymbolTooLong);
    require!(args.uri.len() <= 200, SssError::UriTooLong);

    let (default_perm_delegate, default_hook, default_frozen, default_fees) = match args.preset {
        1 => (true, false, false, false),
        2 => (true, true, true, false),
        3 => (true, false, false, false),
        4 => (true, true, true, true),
        _ => unreachable!(),
    };

    if let Some(bps) = args.transfer_fee_basis_points {
        require!(bps <= 10_000, SssError::InvalidFeeBasisPoints);
    }

    let mut config = ctx.accounts.config.load_init()?;
    config.authority = ctx.accounts.authority.key();
    config.mint = ctx.accounts.mint.key();
    config.preset = args.preset;
    config.paused = 0;
    config.has_supply_cap = if args.supply_cap.is_some() { 1 } else { 0 };
    config.supply_cap = args.supply_cap.unwrap_or(0);
    config.total_minted = 0;
    config.total_burned = 0;
    config.bump = ctx.bumps.config;
    StablecoinConfig::set_bytes(&mut config.name, &args.name);
    StablecoinConfig::set_bytes(&mut config.symbol, &args.symbol);
    StablecoinConfig::set_bytes(&mut config.uri, &args.uri);
    config.decimals = args.decimals;
    config.enable_permanent_delegate = if args.enable_permanent_delegate.unwrap_or(default_perm_delegate) { 1 } else { 0 };
    config.enable_transfer_hook = if args.enable_transfer_hook.unwrap_or(default_hook) { 1 } else { 0 };
    config.default_account_frozen = if args.default_account_frozen.unwrap_or(default_frozen) { 1 } else { 0 };
    config.admin_count = 1;

    config.has_oracle_feed = if args.oracle_feed_id.is_some() { 1 } else { 0 };
    config.oracle_feed_id = args.oracle_feed_id.unwrap_or([0u8; 32]);

    if default_fees {
        config.transfer_fee_basis_points = args.transfer_fee_basis_points.unwrap_or(0);
        config.maximum_fee = args.maximum_fee.unwrap_or(0);
    } else {
        config.transfer_fee_basis_points = 0;
        config.maximum_fee = 0;
    }

    config.has_pending_authority = 0;
    config.pending_authority = Pubkey::default();
    config._reserved = [0u8; 31];
    drop(config);

    let admin_role = &mut ctx.accounts.admin_role;
    admin_role.config = ctx.accounts.config.key();
    admin_role.address = ctx.accounts.authority.key();
    admin_role.role = Role::Admin;
    admin_role.granted_by = ctx.accounts.authority.key();
    admin_role.granted_at = Clock::get()?.unix_timestamp;
    admin_role.bump = ctx.bumps.admin_role;
    admin_role.mint_quota = None;
    admin_role.amount_minted = 0;

    emit!(StablecoinInitialized {
        mint: ctx.accounts.mint.key(),
        authority: ctx.accounts.authority.key(),
        preset: args.preset,
        supply_cap: args.supply_cap,
        name: args.name,
        symbol: args.symbol,
        decimals: args.decimals,
    });

    Ok(())
}
