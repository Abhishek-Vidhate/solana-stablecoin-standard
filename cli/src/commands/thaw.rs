use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use solana_sdk::{instruction::Instruction, transaction::Transaction};

use crate::config::CliContext;
use crate::utils::*;

/// Execute thaw and return tx signature. Used by CLI and TUI.
pub fn execute(ctx: &CliContext, mint_str: &str, account_str: &str) -> Result<String> {
    let mint = parse_pubkey(mint_str)?;
    let token_account = parse_pubkey(account_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (freezer_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 2);

    let ix_data = sss_core::instruction::ThawAccount {}.data();
    let accounts = sss_core::accounts::ThawTokenAccount {
        freezer: ctx.payer_pubkey(),
        config: config_pda,
        freezer_role: freezer_role_pda,
        mint,
        token_account,
        token_program: spl_token_2022::ID,
    }
    .to_account_metas(None);

    let ix = Instruction {
        program_id: sss_core::ID,
        data: ix_data,
        accounts,
    };

    let blockhash = ctx.client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&ctx.payer_pubkey()),
        &[&ctx.payer],
        blockhash,
    );

    let sig = ctx.client.send_and_confirm_transaction(&tx)?;
    Ok(sig.to_string())
}

pub fn run(ctx: &CliContext, mint_str: &str, account_str: &str) -> Result<()> {
    let sig = execute(ctx, mint_str, account_str)?;
    print_success("Account thawed");
    print_field("Mint", mint_str);
    print_field("Token Account", account_str);
    print_tx(&sig);
    Ok(())
}
