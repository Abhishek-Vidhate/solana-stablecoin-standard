use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use solana_sdk::{instruction::Instruction, transaction::Transaction};

use crate::config::CliContext;
use crate::utils::*;

/// Execute seize and return tx signature. Used by CLI and TUI.
pub fn execute(
    ctx: &CliContext,
    mint_str: &str,
    from_str: &str,
    to_str: &str,
    amount: u64,
) -> Result<String> {
    let mint = parse_pubkey(mint_str)?;
    let from = parse_pubkey(from_str)?;
    let to = parse_pubkey(to_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (seizer_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 6);

    let ix_data = sss_core::instruction::Seize { amount }.data();
    let accounts = sss_core::accounts::Seize {
        seizer: ctx.payer_pubkey(),
        config: config_pda,
        seizer_role: seizer_role_pda,
        mint,
        from,
        to,
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

pub fn run(
    ctx: &CliContext,
    mint_str: &str,
    from_str: &str,
    to_str: &str,
    amount: u64,
) -> Result<()> {
    let sig = execute(ctx, mint_str, from_str, to_str, amount)?;
    print_success(&format!("Seized {amount} tokens"));
    print_field("Mint", mint_str);
    print_field("From", from_str);
    print_field("To", to_str);
    print_tx(&sig);
    Ok(())
}
