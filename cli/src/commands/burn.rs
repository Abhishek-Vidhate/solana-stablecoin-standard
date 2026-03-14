use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use solana_sdk::{instruction::Instruction, transaction::Transaction};
use spl_associated_token_account::get_associated_token_address_with_program_id;

use crate::config::CliContext;
use crate::utils::*;

/// Execute burn and return tx signature. Used by CLI and TUI.
pub fn execute(ctx: &CliContext, mint_str: &str, from_str: &str, amount: u64) -> Result<String> {
    let mint = parse_pubkey(mint_str)?;
    let from_owner = parse_pubkey(from_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (burner_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 4);

    let from_ata =
        get_associated_token_address_with_program_id(&from_owner, &mint, &spl_token_2022::ID);

    let ix_data = sss_core::instruction::BurnTokens { amount }.data();
    let mut accounts = sss_core::accounts::BurnTokens {
        burner: ctx.payer_pubkey(),
        config: config_pda,
        burner_role: burner_role_pda,
        mint,
        from: from_ata,
        token_program: spl_token_2022::ID,
    }
    .to_account_metas(None);

    for acc in &mut accounts {
        if acc.pubkey.to_string() == "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" {
            acc.pubkey = spl_token_2022::ID;
        }
    }

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

pub fn run(ctx: &CliContext, mint_str: &str, from_str: &str, amount: u64) -> Result<()> {
    let sig = execute(ctx, mint_str, from_str, amount)?;
    let from_ata =
        get_associated_token_address_with_program_id(&parse_pubkey(from_str)?, &parse_pubkey(mint_str)?, &spl_token_2022::ID);
    print_success(&format!("Burned {amount} tokens"));
    print_field("Mint", mint_str);
    print_field("From Owner", from_str);
    print_field("From ATA", &from_ata.to_string());
    print_tx(&sig);
    Ok(())
}
