use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::Result;
use serde::Deserialize;
use solana_sdk::{
    instruction::Instruction,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::Transaction,
};
#[allow(deprecated)]
use solana_sdk::system_instruction;

use crate::config::CliContext;
use crate::utils::*;

#[derive(Deserialize)]
struct TomlConfig {
    name: String,
    symbol: String,
    #[serde(default)]
    uri: String,
    #[serde(default = "default_decimals")]
    decimals: u8,
    supply_cap: Option<u64>,
    #[serde(default = "default_true")]
    #[allow(dead_code)]
    enable_permanent_delegate: bool,
    #[serde(default)]
    enable_transfer_hook: bool,
    #[serde(default)]
    #[allow(dead_code)]
    default_account_frozen: bool,
}

fn default_decimals() -> u8 {
    6
}
fn default_true() -> bool {
    true
}

/// Run init: create mint (if needed) and initialize sss-core config.
/// If mint_path is None, generates a new keypair. If Some(path), loads from file.
/// If config_path is Some, loads preset/name/symbol from TOML (preset inferred from enable_transfer_hook).
pub fn run(
    ctx: &CliContext,
    preset: Option<&str>,
    config_path: Option<&str>,
    mint_path: Option<&str>,
    name: Option<&str>,
    symbol: Option<&str>,
    uri: &str,
    decimals: u8,
    supply_cap: Option<u64>,
) -> Result<()> {
    let (preset_str, name_val, symbol_val, uri_val, decimals_val, supply_cap_val) =
        if let Some(path) = config_path {
            let contents = std::fs::read_to_string(path)
                .map_err(|e| anyhow::anyhow!("Failed to read config file '{}': {}", path, e))?;
            let cfg: TomlConfig = toml::from_str(&contents)
                .map_err(|e| anyhow::anyhow!("Failed to parse TOML config '{}': {}", path, e))?;
            let inferred = if cfg.enable_transfer_hook {
                "sss-2"
            } else {
                "sss-1"
            };
            println!("Loaded config from: {}", path);
            println!("  Inferred preset: {}", inferred);
            (
                inferred.to_string(),
                cfg.name,
                cfg.symbol,
                cfg.uri,
                cfg.decimals,
                cfg.supply_cap,
            )
        } else {
            (
                preset.expect("--preset required when --config not provided")
                    .to_string(),
                name.expect("--name required when --config not provided")
                    .to_string(),
                symbol
                    .expect("--symbol required when --config not provided")
                    .to_string(),
                uri.to_string(),
                decimals,
                supply_cap,
            )
        };

    let preset_u8 = parse_preset(&preset_str)?;

    if preset_u8 == 3 {
        anyhow::bail!(
            "SSS-3 (Private) initialization requires the TypeScript SDK for \
             ConfidentialTransferMint extension setup. Use the SDK create() instead.\n\
             See: docs/SSS-3.md"
        );
    }

    let mint_kp = match mint_path {
        Some(p) => load_mint_keypair(p)?,
        None => Keypair::new(),
    };
    let mint = mint_kp.pubkey();

    let (config_pda, _) = derive_config_pda(&mint);
    let (admin_role_pda, _) = derive_role_pda(&config_pda, &ctx.payer_pubkey(), 0);

    let (enable_hook, default_frozen) = match preset_u8 {
        2 | 4 => (Some(true), Some(true)),
        _ => (None, None),
    };

    // 1. Build mint creation instructions (Token-2022 extensions)
    let mint_ixs = build_mint_instructions(
        &ctx.client,
        &ctx.payer_pubkey(),
        &mint,
        preset_u8,
        decimals_val,
    )?;

    // 2. sss-core Initialize
    let args = sss_core::instruction::Initialize {
        args: sss_core::instructions::InitializeArgs {
            preset: preset_u8,
            name: name_val.clone(),
            symbol: symbol_val.clone(),
            uri: uri_val.clone(),
            decimals: decimals_val,
            supply_cap: supply_cap_val,
            enable_permanent_delegate: Some(true),
            enable_transfer_hook: enable_hook,
            default_account_frozen: default_frozen,
            oracle_feed_id: None,
            transfer_fee_basis_points: if preset_u8 == 4 { Some(0) } else { None },
            maximum_fee: if preset_u8 == 4 { Some(0) } else { None },
        },
    };

    let init_ix = Instruction {
        program_id: sss_core::ID,
        data: args.data(),
        accounts: sss_core::accounts::Initialize {
            authority: ctx.payer_pubkey(),
            config: config_pda,
            mint,
            admin_role: admin_role_pda,
            token_program: spl_token_2022::ID,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
    };

    let mut instructions = mint_ixs;
    instructions.push(init_ix);

    // 3. Hook init for SSS-2/4
    if matches!(preset_u8, 2 | 4) {
        let (extra_metas_pda, _) = derive_extra_account_metas_pda(&mint);
        let hook_ix = Instruction {
            program_id: sss_transfer_hook::ID,
            data: sss_transfer_hook::instruction::InitializeExtraAccountMetas {}.data(),
            accounts: sss_transfer_hook::accounts::InitializeExtraAccountMetas {
                payer: ctx.payer_pubkey(),
                extra_account_metas: extra_metas_pda,
                mint,
                system_program: solana_sdk::system_program::ID,
            }
            .to_account_metas(None),
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

    print_success(&format!("Stablecoin initialized ({})", preset_name(preset_u8)));
    print_field("Mint", &mint.to_string());
    print_field("Config PDA", &config_pda.to_string());
    print_field("Name", &name_val);
    print_field("Symbol", &symbol_val);
    print_field("Decimals", &decimals_val.to_string());
    if let Some(cap) = supply_cap_val {
        print_field("Supply Cap", &format_amount(cap, decimals_val));
    }
    println!();
    println!("  export SSS_MINT={}", mint);
    print_tx(&sig.to_string());

    Ok(())
}

fn build_mint_instructions(
    client: &solana_client::rpc_client::RpcClient,
    payer: &Pubkey,
    mint: &Pubkey,
    preset: u8,
    decimals: u8,
) -> Result<Vec<Instruction>> {
    use spl_token_2022::extension::ExtensionType;

    let mut extensions = vec![ExtensionType::PermanentDelegate];
    if preset == 2 || preset == 4 {
        extensions.push(ExtensionType::TransferHook);
        extensions.push(ExtensionType::DefaultAccountState);
    }
    if preset == 4 {
        extensions.push(ExtensionType::TransferFeeConfig);
    }

    let mint_len = ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(
        &extensions,
    )
    .map_err(|e| anyhow::anyhow!("Mint length: {}", e))?;

    let lamports = client.get_minimum_balance_for_rent_exemption(mint_len)?;

    build_mint_instructions_impl(payer, mint, preset, decimals, mint_len, lamports)
}

fn build_mint_instructions_impl(
    payer: &Pubkey,
    mint: &Pubkey,
    preset: u8,
    decimals: u8,
    mint_len: usize,
    lamports: u64,
) -> Result<Vec<Instruction>> {
    let (config_pda, _) = derive_config_pda(mint);

    let mut ixs = vec![];

    ixs.push(system_instruction::create_account(
        payer,
        mint,
        lamports,
        mint_len as u64,
        &spl_token_2022::ID,
    ));

    ixs.push(
        spl_token_2022::instruction::initialize_permanent_delegate(
            &spl_token_2022::ID,
            mint,
            &config_pda,
        )?,
    );

    if preset == 2 || preset == 4 {
        ixs.push(
            spl_token_2022::extension::transfer_hook::instruction::initialize(
                &spl_token_2022::ID,
                mint,
                Some(config_pda),
                Some(sss_transfer_hook::ID),
            )?,
        );
        ixs.push(
            spl_token_2022::extension::default_account_state::instruction::initialize_default_account_state(
                &spl_token_2022::ID,
                mint,
                &spl_token_2022::state::AccountState::Frozen,
            )?,
        );
    }

    if preset == 4 {
        ixs.push(
            spl_token_2022::extension::transfer_fee::instruction::initialize_transfer_fee_config(
                &spl_token_2022::ID,
                mint,
                Some(&config_pda),
                Some(&config_pda),
                0,
                0,
            )?,
        );
    }

    ixs.push(
        spl_token_2022::instruction::initialize_mint(
            &spl_token_2022::ID,
            mint,
            &config_pda,
            Some(&config_pda),
            decimals,
        )?,
    );

    Ok(ixs)
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
        .map_err(|e| anyhow::anyhow!("Failed to read mint keypair from {}: {}", expanded, e))?;

    let bytes: Vec<u8> = serde_json::from_str(&data)
        .map_err(|e| anyhow::anyhow!("Failed to parse mint keypair JSON: {}", e))?;

    Keypair::try_from(bytes.as_slice())
        .map_err(|e| anyhow::anyhow!("Invalid mint keypair bytes: {}", e))
}
