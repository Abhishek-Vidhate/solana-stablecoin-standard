use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::Mint;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

use crate::constants::BLACKLIST_SEED;

#[derive(Accounts)]
pub struct InitializeExtraAccountMetas<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList PDA, created in this instruction.
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
    )]
    pub extra_account_metas: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handler_initialize(ctx: Context<InitializeExtraAccountMetas>) -> Result<()> {
    let extra_account_metas = ctx.accounts.extra_account_metas.to_account_info();
    let mint = ctx.accounts.mint.to_account_info();

    // Transfer hook execute account ordering (SPL spec):
    //   0 = source token account
    //   1 = mint
    //   2 = destination token account
    //   3 = source authority (owner/delegate)
    //   4 = extra_account_metas PDA
    //
    // We add two extra accounts resolved by Token-2022:
    //   5 = sender blacklist PDA  [blacklist, mint, source_owner]
    //   6 = receiver blacklist PDA [blacklist, mint, dest_owner]
    let account_metas = vec![
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: BLACKLIST_SEED.to_vec(),
                },
                Seed::AccountKey { index: 1 }, // mint
                Seed::AccountData {
                    account_index: 0, // source token account
                    data_index: 32,   // offset of `owner` field
                    length: 32,
                },
            ],
            false,
            false,
        )?,
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: BLACKLIST_SEED.to_vec(),
                },
                Seed::AccountKey { index: 1 }, // mint
                Seed::AccountData {
                    account_index: 2, // destination token account
                    data_index: 32,   // offset of `owner` field
                    length: 32,
                },
            ],
            false,
            false,
        )?,
    ];

    let account_size = ExtraAccountMetaList::size_of(account_metas.len())?;
    let lamports = Rent::get()?.minimum_balance(account_size);
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"extra-account-metas",
        mint.key.as_ref(),
        &[ctx.bumps.extra_account_metas],
    ]];

    system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::CreateAccount {
                from: ctx.accounts.payer.to_account_info(),
                to: extra_account_metas.clone(),
            },
            signer_seeds,
        ),
        lamports,
        account_size as u64,
        ctx.program_id,
    )?;

    ExtraAccountMetaList::init::<ExecuteInstruction>(
        &mut extra_account_metas.try_borrow_mut_data()?,
        &account_metas,
    )?;

    Ok(())
}
