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

    println!("{}", "Supply Information".bold().cyan());
    print_separator();
    print_field("Mint", &cfg.mint.to_string());
    print_field("Name", &format!("{} ({})", cfg.name, cfg.symbol));
    print_field("Decimals", &cfg.decimals.to_string());
    print_separator();
    print_field("Total Minted", &format_amount(cfg.total_minted, cfg.decimals));
    print_field("Total Burned", &format_amount(cfg.total_burned, cfg.decimals));
    print_field(
        "Current Supply",
        &format_amount(cfg.current_supply(), cfg.decimals),
    );
    if cfg.has_supply_cap {
        print_field("Supply Cap", &format_amount(cfg.supply_cap, cfg.decimals));
        let remaining = cfg.supply_cap.saturating_sub(cfg.current_supply());
        print_field(
            "Remaining Capacity",
            &format_amount(remaining, cfg.decimals),
        );
        if cfg.supply_cap > 0 {
            let pct = (cfg.current_supply() as f64 / cfg.supply_cap as f64) * 100.0;
            print_field("Utilization", &format!("{pct:.2}%"));
        }
    } else {
        print_field("Supply Cap", "None (unlimited)");
    }

    Ok(())
}
