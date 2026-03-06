use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use colored::Colorize;
use solana_sdk::{instruction::Instruction, transaction::Transaction};

use crate::config::CliContext;
use crate::utils::*;

pub fn add(ctx: &CliContext, mint_str: &str, address_str: &str, reason: &str) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let address = parse_pubkey(address_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (blacklister_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 5);
    let (blacklist_pda, _) = derive_blacklist_pda(&mint, &address);

    let ix_data = sss_transfer_hook::instruction::AddToBlacklist {
        reason: reason.to_string(),
    }
    .data();

    let accounts = sss_transfer_hook::accounts::AddToBlacklist {
        blacklister: ctx.payer_pubkey(),
        blacklister_role: blacklister_role_pda,
        mint,
        address,
        blacklist_entry: blacklist_pda,
        system_program: solana_sdk::system_program::ID,
    }
    .to_account_metas(None);

    let ix = Instruction {
        program_id: sss_transfer_hook::ID,
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

    print_success("Address added to blacklist");
    print_field("Mint", mint_str);
    print_field("Address", address_str);
    print_field("Reason", reason);
    print_tx(&sig.to_string());

    Ok(())
}

pub fn remove(ctx: &CliContext, mint_str: &str, address_str: &str) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let address = parse_pubkey(address_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (blacklister_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 5);
    let (blacklist_pda, _) = derive_blacklist_pda(&mint, &address);

    let ix_data = sss_transfer_hook::instruction::RemoveFromBlacklist {}.data();

    let accounts = sss_transfer_hook::accounts::RemoveFromBlacklist {
        blacklister: ctx.payer_pubkey(),
        blacklister_role: blacklister_role_pda,
        mint,
        blacklist_entry: blacklist_pda,
    }
    .to_account_metas(None);

    let ix = Instruction {
        program_id: sss_transfer_hook::ID,
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

    print_success("Address removed from blacklist");
    print_field("Mint", mint_str);
    print_field("Address", address_str);
    print_tx(&sig.to_string());

    Ok(())
}

pub fn check(ctx: &CliContext, mint_str: &str, address_str: &str) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let address = parse_pubkey(address_str)?;
    let (blacklist_pda, _) = derive_blacklist_pda(&mint, &address);

    match ctx.client.get_account(&blacklist_pda) {
        Ok(_account) => {
            println!(
                "{} Address {} is {}",
                "!".red().bold(),
                address_str,
                "BLACKLISTED".red().bold()
            );
            print_field("Blacklist PDA", &blacklist_pda.to_string());
        }
        Err(_) => {
            println!(
                "{} Address {} is {}",
                "✓".green().bold(),
                address_str,
                "not blacklisted".green()
            );
        }
    }

    Ok(())
}
