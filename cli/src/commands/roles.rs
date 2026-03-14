use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use colored::Colorize;
use solana_client::rpc_filter::{Memcmp, MemcmpEncodedBytes, RpcFilterType};
use solana_sdk::{instruction::Instruction, transaction::Transaction};

use crate::config::CliContext;
use crate::utils::*;

/// Execute grant role and return tx signature. Used by CLI and TUI.
pub fn grant_execute(ctx: &CliContext, mint_str: &str, address_str: &str, role_str: &str) -> Result<String> {
    let mint = parse_pubkey(mint_str)?;
    let grantee = parse_pubkey(address_str)?;
    let role = parse_role(role_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (admin_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 0);
    let (new_role_pda, _) = derive_role_pda(&config_pda, &grantee, role);

    let ix_data = sss_core::instruction::GrantRole { role }.data();
    let accounts = sss_core::accounts::GrantRole {
        admin: ctx.payer_pubkey(),
        config: config_pda,
        admin_role: admin_role_pda,
        grantee,
        role_account: new_role_pda,
        system_program: solana_sdk::system_program::ID,
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

pub fn grant(ctx: &CliContext, mint_str: &str, address_str: &str, role_str: &str) -> Result<()> {
    let sig = grant_execute(ctx, mint_str, address_str, role_str)?;
    print_success(&format!("Granted {} role", role_name(parse_role(role_str)?)));
    print_field("Mint", mint_str);
    print_field("Address", address_str);
    print_field("Role", role_str);
    print_tx(&sig);
    Ok(())
}

/// Execute revoke role and return tx signature. Used by CLI and TUI.
pub fn revoke_execute(ctx: &CliContext, mint_str: &str, address_str: &str, role_str: &str) -> Result<String> {
    let mint = parse_pubkey(mint_str)?;
    let target = parse_pubkey(address_str)?;
    let role = parse_role(role_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (admin_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 0);
    let (role_pda, _) = derive_role_pda(&config_pda, &target, role);

    let ix_data = sss_core::instruction::RevokeRole {}.data();
    let accounts = sss_core::accounts::RevokeRole {
        admin: ctx.payer_pubkey(),
        config: config_pda,
        admin_role: admin_role_pda,
        role_account: role_pda,
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

pub fn revoke(ctx: &CliContext, mint_str: &str, address_str: &str, role_str: &str) -> Result<()> {
    let sig = revoke_execute(ctx, mint_str, address_str, role_str)?;
    print_success(&format!("Revoked {} role", role_name(parse_role(role_str)?)));
    print_field("Mint", mint_str);
    print_field("Address", address_str);
    print_field("Role", role_str);
    print_tx(&sig);
    Ok(())
}

pub fn list(ctx: &CliContext, mint_str: &str) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let (config_pda, _) = derive_config_pda(&mint);

    // RoleAccount layout after 8-byte discriminator: config (32 bytes)
    let filters = vec![
        RpcFilterType::DataSize(131), // ROLE_SPACE
        RpcFilterType::Memcmp(Memcmp::new_raw_bytes(8, config_pda.as_ref().to_vec())),
    ];

    let accounts = ctx
        .client
        .get_program_accounts_with_config(
            &sss_core::ID,
            solana_client::rpc_config::RpcProgramAccountsConfig {
                filters: Some(filters),
                account_config: solana_client::rpc_config::RpcAccountInfoConfig {
                    encoding: Some(solana_account_decoder::UiAccountEncoding::Base64),
                    ..Default::default()
                },
                ..Default::default()
            },
        )?;

    println!("{}", "Roles".bold().cyan());
    print_separator();
    print_field("Mint", mint_str);
    print_field("Config PDA", &config_pda.to_string());
    print_field("Total Roles Found", &accounts.len().to_string());
    print_separator();

    for (pubkey, account) in &accounts {
        let data = &account.data;
        if data.len() < 8 + 32 + 32 + 1 {
            continue;
        }
        // Skip discriminator (8), config (32) -> address starts at 40
        let address = solana_sdk::pubkey::Pubkey::try_from(&data[40..72]).unwrap_or_default();
        // Role enum is 1 byte at offset 72
        let role_byte = data[72];

        println!(
            "  {} {} -> {}",
            "•".dimmed(),
            address,
            role_name(role_byte).bold()
        );
        print_field("    PDA", &pubkey.to_string());
    }

    Ok(())
}
