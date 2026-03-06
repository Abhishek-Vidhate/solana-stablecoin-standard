use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use colored::Colorize;
use solana_sdk::{instruction::Instruction, transaction::Transaction};
use spl_associated_token_account::get_associated_token_address_with_program_id;

use crate::config::CliContext;
use crate::utils::*;

pub fn update(ctx: &CliContext, mint_str: &str, bps: u16, max_fee: u64) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (admin_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 0);

    let ix_data = sss_core::instruction::UpdateTransferFee {
        new_basis_points: bps,
        new_maximum_fee: max_fee,
    }
    .data();

    let accounts = sss_core::accounts::UpdateTransferFee {
        admin: ctx.payer_pubkey(),
        config: config_pda,
        admin_role: admin_role_pda,
        mint,
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

    print_success("Transfer fee updated");
    print_field("Mint", mint_str);
    print_field("Basis Points", &bps.to_string());
    print_field("Maximum Fee", &max_fee.to_string());
    print_tx(&sig.to_string());

    Ok(())
}

pub fn withdraw(ctx: &CliContext, mint_str: &str, destination_str: &str) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let dest_wallet = parse_pubkey(destination_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (admin_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 0);

    let fee_destination =
        get_associated_token_address_with_program_id(&dest_wallet, &mint, &spl_token_2022::ID);

    let ix_data = sss_core::instruction::WithdrawWithheld {}.data();

    let accounts = sss_core::accounts::WithdrawWithheld {
        admin: ctx.payer_pubkey(),
        config: config_pda,
        admin_role: admin_role_pda,
        mint,
        fee_destination,
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

    print_success("Withheld fees withdrawn");
    print_field("Mint", mint_str);
    print_field("Destination ATA", &fee_destination.to_string());
    print_tx(&sig.to_string());

    Ok(())
}

pub fn show(ctx: &CliContext, mint_str: &str) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let (config_pda, _) = derive_config_pda(&mint);

    let account = ctx
        .client
        .get_account(&config_pda)
        .map_err(|e| anyhow::anyhow!("Failed to fetch config account {config_pda}: {e}"))?;

    let cfg = parse_config_account(&account.data)?;

    if cfg.preset != 4 {
        anyhow::bail!(
            "Stablecoin is preset {} — transfer fees are only available on SSS-4",
            preset_name(cfg.preset)
        );
    }

    println!("{}", "Transfer Fee Configuration".bold().cyan());
    print_separator();
    print_field("Mint", &cfg.mint.to_string());
    print_field("Name", &format!("{} ({})", cfg.name, cfg.symbol));
    print_separator();
    print_field(
        "Fee (basis points)",
        &cfg.transfer_fee_basis_points.to_string(),
    );
    let pct = cfg.transfer_fee_basis_points as f64 / 100.0;
    print_field("Fee (%)", &format!("{pct:.2}%"));
    print_field(
        "Maximum Fee",
        &format_amount(cfg.maximum_fee, cfg.decimals),
    );

    Ok(())
}
