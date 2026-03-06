use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use colored::Colorize;
use solana_client::rpc_filter::{Memcmp, RpcFilterType};
use solana_sdk::{instruction::Instruction, transaction::Transaction};

use crate::config::CliContext;
use crate::utils::*;

/// Grant a minter role then optionally set the quota.
pub fn add(
    ctx: &CliContext,
    mint_str: &str,
    address_str: &str,
    quota: Option<u64>,
) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let minter_addr = parse_pubkey(address_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (admin_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 0);
    let (minter_role_pda, _) = derive_role_pda(&config_pda, &minter_addr, 1);

    let mut instructions = Vec::new();

    // First: grant the Minter role (role=1)
    let grant_data = sss_core::instruction::GrantRole { role: 1 }.data();
    let grant_accounts = sss_core::accounts::GrantRole {
        admin: ctx.payer_pubkey(),
        config: config_pda,
        admin_role: admin_role_pda,
        grantee: minter_addr,
        role_account: minter_role_pda,
        system_program: solana_sdk::system_program::ID,
    }
    .to_account_metas(None);

    instructions.push(Instruction {
        program_id: sss_core::ID,
        data: grant_data,
        accounts: grant_accounts,
    });

    // Second: if quota is specified, set it via update_minter
    if quota.is_some() {
        let update_data = sss_core::instruction::UpdateMinter {
            new_quota: quota,
        }
        .data();

        let update_accounts = sss_core::accounts::UpdateMinter {
            admin: ctx.payer_pubkey(),
            config: config_pda,
            admin_role: admin_role_pda,
            minter_role: minter_role_pda,
        }
        .to_account_metas(None);

        instructions.push(Instruction {
            program_id: sss_core::ID,
            data: update_data,
            accounts: update_accounts,
        });
    }

    let blockhash = ctx.client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &instructions,
        Some(&ctx.payer_pubkey()),
        &[&ctx.payer],
        blockhash,
    );

    let sig = ctx.client.send_and_confirm_transaction(&tx)?;

    print_success("Minter added");
    print_field("Mint", mint_str);
    print_field("Minter", address_str);
    if let Some(q) = quota {
        print_field("Quota", &q.to_string());
    } else {
        print_field("Quota", "Unlimited");
    }
    print_tx(&sig.to_string());

    Ok(())
}

/// Revoke the minter role.
pub fn remove(ctx: &CliContext, mint_str: &str, address_str: &str) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let minter_addr = parse_pubkey(address_str)?;

    let (config_pda, _) = derive_config_pda(&mint);
    let (admin_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 0);
    let (minter_role_pda, _) = derive_role_pda(&config_pda, &minter_addr, 1);

    let ix_data = sss_core::instruction::RevokeRole {}.data();
    let accounts = sss_core::accounts::RevokeRole {
        admin: ctx.payer_pubkey(),
        config: config_pda,
        admin_role: admin_role_pda,
        role_account: minter_role_pda,
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

    print_success("Minter removed");
    print_field("Mint", mint_str);
    print_field("Minter", address_str);
    print_tx(&sig.to_string());

    Ok(())
}

/// List all minters (role=1 accounts) for a given config.
pub fn list(ctx: &CliContext, mint_str: &str) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let (config_pda, _) = derive_config_pda(&mint);

    let filters = vec![
        RpcFilterType::DataSize(131),
        RpcFilterType::Memcmp(Memcmp::new_base58_encoded(8, config_pda.as_ref())),
    ];

    let accounts = ctx
        .client
        .get_program_accounts_with_config(
            &sss_core::ID,
            solana_client::rpc_config::RpcProgramAccountsConfig {
                filters: Some(filters),
                ..Default::default()
            },
        )?;

    println!("{}", "Minters".bold().cyan());
    print_separator();
    print_field("Mint", mint_str);
    print_separator();

    let mut count = 0u32;
    for (pubkey, account) in &accounts {
        let data = &account.data;
        if data.len() < 73 {
            continue;
        }
        let role_byte = data[72];
        if role_byte != 1 {
            continue;
        }

        count += 1;
        let address = solana_sdk::pubkey::Pubkey::try_from(&data[40..72]).unwrap_or_default();

        // Parse quota: offset after discriminator(8)+config(32)+address(32)+role(1+padding)
        // RoleAccount Borsh layout: config(32)+address(32)+role(1)+granted_by(32)+granted_at(8)+bump(1)
        // then Option<u64> mint_quota (1+8), amount_minted (8)
        // Offset from data start: 8 + 32 + 32 + 1 + 32 + 8 + 1 = 114
        let quota_info = if data.len() >= 123 {
            if data[114] == 1 {
                let q = u64::from_le_bytes(data[115..123].try_into().unwrap_or([0; 8]));
                format!("{q}")
            } else {
                "Unlimited".to_string()
            }
        } else {
            "Unknown".to_string()
        };

        let minted_info = if data.len() >= 131 {
            let m = u64::from_le_bytes(data[123..131].try_into().unwrap_or([0; 8]));
            format!("{m}")
        } else {
            "Unknown".to_string()
        };

        println!("  {} {}", "•".dimmed(), address.to_string().bold());
        print_field("    PDA", &pubkey.to_string());
        print_field("    Quota", &quota_info);
        print_field("    Amount Minted", &minted_info);
    }

    if count == 0 {
        println!("  {}", "No minters found".dimmed());
    } else {
        print_separator();
        print_field("Total Minters", &count.to_string());
    }

    Ok(())
}
