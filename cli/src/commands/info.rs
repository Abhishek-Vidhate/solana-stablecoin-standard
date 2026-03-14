use anyhow::Result;
use colored::Colorize;

use crate::config::CliContext;
use crate::utils::*;

pub fn run(ctx: &CliContext, mint_str: &str) -> Result<()> {
    let mint = parse_pubkey(mint_str)?;
    let (config_pda, _) = derive_config_pda(&mint);

    let account = ctx
        .client
        .get_account(&config_pda)
        .map_err(|e| anyhow::anyhow!("Failed to fetch config account {config_pda}: {e}"))?;

    let cfg = parse_config_account(&account.data)?;

    println!("{}", "Stablecoin Configuration".bold().cyan());
    print_separator();
    print_field("Name", &cfg.name);
    print_field("Symbol", &cfg.symbol);
    print_field("Preset", preset_name(cfg.preset));
    print_field("Mint", &cfg.mint.to_string());
    print_field("Authority", &cfg.authority.to_string());
    print_field("Decimals", &cfg.decimals.to_string());
    print_field("Paused", &format!("{}", cfg.paused));
    print_separator();

    print_field("Total Minted", &format_amount(cfg.total_minted, cfg.decimals));
    print_field("Total Burned", &format_amount(cfg.total_burned, cfg.decimals));
    print_field(
        "Current Supply",
        &format_amount(cfg.current_supply(), cfg.decimals),
    );
    if cfg.has_supply_cap {
        print_field("Supply Cap", &format_amount(cfg.supply_cap, cfg.decimals));
    } else {
        print_field("Supply Cap", "None (unlimited)");
    }
    print_separator();

    print_field("Permanent Delegate", &format!("{}", cfg.enable_permanent_delegate));
    print_field("Transfer Hook", &format!("{}", cfg.enable_transfer_hook));
    print_field("Default Frozen", &format!("{}", cfg.default_account_frozen));
    print_field("Admin Count", &cfg.admin_count.to_string());
    print_separator();

    if cfg.preset == 4 {
        print_field(
            "Transfer Fee (bps)",
            &cfg.transfer_fee_basis_points.to_string(),
        );
        print_field(
            "Maximum Fee",
            &format_amount(cfg.maximum_fee, cfg.decimals),
        );
        print_separator();
    }

    if cfg.has_oracle_feed {
        print_field("Oracle Feed", &bs58::encode(&cfg.oracle_feed_id).into_string());
    }

    if !cfg.uri.is_empty() {
        print_field("URI", &cfg.uri);
    }

    if cfg.has_pending_authority {
        print_field("Pending Authority", &cfg.pending_authority.to_string());
    }

    Ok(())
}
