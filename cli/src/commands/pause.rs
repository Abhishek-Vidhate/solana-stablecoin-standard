use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use solana_sdk::{instruction::Instruction, transaction::Transaction};

use crate::config::CliContext;
use crate::utils::*;

/// Execute pause/unpause and return tx signature. Used by CLI and TUI.
pub fn execute(ctx: &CliContext, mint_str: &str, unpause: bool) -> Result<String> {
    let mint = parse_pubkey(mint_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (pauser_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 3);

    let ix = if unpause {
        let ix_data = sss_core::instruction::Unpause {}.data();
        let accounts = sss_core::accounts::Unpause {
            pauser: ctx.payer_pubkey(),
            config: config_pda,
            pauser_role: pauser_role_pda,
        }
        .to_account_metas(None);

        Instruction {
            program_id: sss_core::ID,
            data: ix_data,
            accounts,
        }
    } else {
        let ix_data = sss_core::instruction::Pause {}.data();
        let accounts = sss_core::accounts::Pause {
            pauser: ctx.payer_pubkey(),
            config: config_pda,
            pauser_role: pauser_role_pda,
        }
        .to_account_metas(None);

        Instruction {
            program_id: sss_core::ID,
            data: ix_data,
            accounts,
        }
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

pub fn run(ctx: &CliContext, mint_str: &str, unpause: bool) -> Result<()> {
    let sig = execute(ctx, mint_str, unpause)?;
    if unpause {
        print_success("Operations unpaused");
    } else {
        print_success("Operations paused");
    }
    print_field("Mint", mint_str);
    print_tx(&sig);
    Ok(())
}
