use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use solana_sdk::{instruction::Instruction, transaction::Transaction};
use spl_associated_token_account::get_associated_token_address_with_program_id;

use crate::config::CliContext;
use crate::utils::*;

/// Execute mint and return tx signature. Used by CLI and TUI.
pub fn execute(ctx: &CliContext, mint_str: &str, to_str: &str, amount: u64) -> Result<String> {
    let mint = parse_pubkey(mint_str)?;
    let to_wallet = parse_pubkey(to_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (minter_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 1);

    let recipient_ata =
        get_associated_token_address_with_program_id(&to_wallet, &mint, &spl_token_2022::ID);

    let ix_data = sss_core::instruction::MintTokens { amount }.data();
    let mut accounts = sss_core::accounts::MintTokens {
        minter: ctx.payer_pubkey(),
        config: config_pda,
        minter_role: minter_role_pda,
        mint,
        to: recipient_ata,
        price_update: None,
        token_program: spl_token_2022::ID,
    }
    .to_account_metas(None);

    // Anchor 0.29 ToAccountMetas codegen puts Option fields before Interface fields if declared that way,
    // but the IDL and program decoder expects optional fields to be LAST (index 6, while token_program is at index 5).
    accounts.swap(5, 6);

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

pub fn run(ctx: &CliContext, mint_str: &str, to_str: &str, amount: u64) -> Result<()> {
    let sig = execute(ctx, mint_str, to_str, amount)?;
    let recipient_ata =
        get_associated_token_address_with_program_id(&parse_pubkey(to_str)?, &parse_pubkey(mint_str)?, &spl_token_2022::ID);
    print_success(&format!("Minted {amount} tokens"));
    print_field("Mint", mint_str);
    print_field("Recipient Wallet", to_str);
    print_field("Recipient ATA", &recipient_ata.to_string());
    print_tx(&sig);
    Ok(())
}
