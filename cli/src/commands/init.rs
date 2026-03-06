use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use solana_sdk::{
    instruction::Instruction, signature::Keypair, signer::Signer, transaction::Transaction,
};

use crate::config::CliContext;
use crate::utils::*;

pub fn run(
    ctx: &CliContext,
    preset_str: &str,
    mint_path: &str,
    name: &str,
    symbol: &str,
    uri: &str,
    decimals: u8,
    supply_cap: Option<u64>,
) -> Result<()> {
    let preset = parse_preset(preset_str)?;

    let mint_kp = load_mint_keypair(mint_path)?;
    let mint = mint_kp.pubkey();

    let (config_pda, _) = derive_config_pda(&mint);
    let (admin_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 0);

    let (enable_hook, default_frozen) = match preset {
        2 | 4 => (Some(true), Some(true)),
        _ => (None, None),
    };

    let args = sss_core::instruction::Initialize {
        args: sss_core::instructions::InitializeArgs {
            preset,
            name: name.to_string(),
            symbol: symbol.to_string(),
            uri: uri.to_string(),
            decimals,
            supply_cap,
            enable_permanent_delegate: Some(true),
            enable_transfer_hook: enable_hook,
            default_account_frozen: default_frozen,
            oracle_feed_id: None,
            transfer_fee_basis_points: if preset == 4 { Some(0) } else { None },
            maximum_fee: if preset == 4 { Some(0) } else { None },
        },
    };

    let accounts = sss_core::accounts::Initialize {
        authority: ctx.payer_pubkey(),
        config: config_pda,
        mint,
        admin_role: admin_role_pda,
        token_program: spl_token_2022::ID,
        system_program: solana_sdk::system_program::ID,
    };

    let ix = Instruction {
        program_id: sss_core::ID,
        data: args.data(),
        accounts: accounts.to_account_metas(None),
    };

    let mut instructions = vec![ix];

    // For presets with transfer hooks, also initialize extra account metas
    if matches!(preset, 2 | 4) {
        let (extra_metas_pda, _) = derive_extra_account_metas_pda(&mint);

        let hook_args = sss_transfer_hook::instruction::InitializeExtraAccountMetas {};
        let hook_accounts = sss_transfer_hook::accounts::InitializeExtraAccountMetas {
            payer: ctx.payer_pubkey(),
            extra_account_metas: extra_metas_pda,
            mint,
            system_program: solana_sdk::system_program::ID,
        };

        let hook_ix = Instruction {
            program_id: sss_transfer_hook::ID,
            data: hook_args.data(),
            accounts: hook_accounts.to_account_metas(None),
        };

        instructions.push(hook_ix);
    }

    let blockhash = ctx.client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &instructions,
        Some(&ctx.payer_pubkey()),
        &[&ctx.payer, &mint_kp],
        blockhash,
    );

    let sig = ctx.client.send_and_confirm_transaction(&tx)?;

    print_success(&format!("Stablecoin initialized ({})", preset_name(preset)));
    print_field("Mint", &mint.to_string());
    print_field("Config PDA", &config_pda.to_string());
    print_field("Name", name);
    print_field("Symbol", symbol);
    print_field("Decimals", &decimals.to_string());
    if let Some(cap) = supply_cap {
        print_field("Supply Cap", &format_amount(cap, decimals));
    }
    print_tx(&sig.to_string());

    Ok(())
}

fn load_mint_keypair(path: &str) -> Result<Keypair> {
    let expanded = if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            path.replacen('~', &home.to_string_lossy(), 1)
        } else {
            path.to_string()
        }
    } else {
        path.to_string()
    };

    let data = std::fs::read_to_string(&expanded)
        .map_err(|e| anyhow::anyhow!("Failed to read mint keypair from {expanded}: {e}"))?;

    let bytes: Vec<u8> = serde_json::from_str(&data)
        .map_err(|e| anyhow::anyhow!("Failed to parse mint keypair JSON: {e}"))?;

    Keypair::try_from(bytes.as_slice())
        .map_err(|e| anyhow::anyhow!("Invalid mint keypair bytes: {e}"))
}
