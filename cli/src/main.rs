mod commands;
mod config;
mod utils;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "sss-token",
    about = "Solana Stablecoin Standard CLI",
    version
)]
pub struct Cli {
    #[arg(
        long,
        env = "SOLANA_RPC_URL",
        default_value = "https://api.devnet.solana.com",
        global = true
    )]
    pub rpc_url: String,

    #[arg(
        long,
        env = "SOLANA_KEYPAIR",
        default_value = "~/.config/solana/id.json",
        global = true
    )]
    pub keypair: String,

    #[arg(long, default_value = "confirmed", global = true)]
    pub commitment: String,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Initialize a new stablecoin
    Init {
        #[arg(long)]
        preset: String,
        #[arg(long, help = "Path to the mint keypair JSON file")]
        mint: String,
        #[arg(long)]
        name: String,
        #[arg(long)]
        symbol: String,
        #[arg(long, default_value = "")]
        uri: String,
        #[arg(long, default_value_t = 6)]
        decimals: u8,
        #[arg(long)]
        supply_cap: Option<u64>,
    },
    /// Mint tokens to a recipient
    Mint {
        #[arg(long)]
        mint: String,
        #[arg(long, help = "Recipient wallet address")]
        to: String,
        #[arg(long)]
        amount: u64,
    },
    /// Burn tokens from an account (permanent delegate)
    Burn {
        #[arg(long)]
        mint: String,
        #[arg(long, help = "Token account owner")]
        from: String,
        #[arg(long)]
        amount: u64,
    },
    /// Freeze a token account
    Freeze {
        #[arg(long)]
        mint: String,
        #[arg(long, help = "Token account address")]
        account: String,
    },
    /// Thaw a frozen token account
    Thaw {
        #[arg(long)]
        mint: String,
        #[arg(long, help = "Token account address")]
        account: String,
    },
    /// Pause or unpause operations
    Pause {
        #[arg(long)]
        mint: String,
        #[arg(long, help = "Unpause instead of pause")]
        unpause: bool,
    },
    /// Seize tokens via permanent delegate
    Seize {
        #[arg(long)]
        mint: String,
        #[arg(long, help = "Source token account")]
        from: String,
        #[arg(long, help = "Destination token account")]
        to: String,
        #[arg(long)]
        amount: u64,
    },
    /// Show stablecoin configuration
    Info {
        #[arg(long)]
        mint: String,
    },
    /// Show supply information
    Supply {
        #[arg(long)]
        mint: String,
    },
    /// Blacklist management
    Blacklist {
        #[command(subcommand)]
        action: BlacklistAction,
    },
    /// Role management
    Roles {
        #[command(subcommand)]
        action: RolesAction,
    },
    /// Minter quota management
    Minters {
        #[command(subcommand)]
        action: MintersAction,
    },
    /// Transfer fee management (SSS-4)
    Fees {
        #[command(subcommand)]
        action: FeesAction,
    },
}

#[derive(Subcommand)]
pub enum BlacklistAction {
    /// Add an address to the blacklist
    Add {
        #[arg(long)]
        mint: String,
        #[arg(long)]
        address: String,
        #[arg(long, default_value = "compliance")]
        reason: String,
    },
    /// Remove an address from the blacklist
    Remove {
        #[arg(long)]
        mint: String,
        #[arg(long)]
        address: String,
    },
    /// Check if an address is blacklisted
    Check {
        #[arg(long)]
        mint: String,
        #[arg(long)]
        address: String,
    },
}

#[derive(Subcommand)]
pub enum RolesAction {
    /// Grant a role to an address
    Grant {
        #[arg(long)]
        mint: String,
        #[arg(long)]
        address: String,
        #[arg(long)]
        role: String,
    },
    /// Revoke a role from an address
    Revoke {
        #[arg(long)]
        mint: String,
        #[arg(long)]
        address: String,
        #[arg(long)]
        role: String,
    },
    /// List roles for a stablecoin
    List {
        #[arg(long)]
        mint: String,
    },
}

#[derive(Subcommand)]
pub enum MintersAction {
    /// Add or update a minter with an optional quota
    Add {
        #[arg(long)]
        mint: String,
        #[arg(long)]
        address: String,
        #[arg(long)]
        quota: Option<u64>,
    },
    /// Remove a minter
    Remove {
        #[arg(long)]
        mint: String,
        #[arg(long)]
        address: String,
    },
    /// List minters for a stablecoin
    List {
        #[arg(long)]
        mint: String,
    },
}

#[derive(Subcommand)]
pub enum FeesAction {
    /// Update transfer fee parameters
    Update {
        #[arg(long)]
        mint: String,
        #[arg(long)]
        bps: u16,
        #[arg(long)]
        max_fee: u64,
    },
    /// Withdraw withheld fees
    Withdraw {
        #[arg(long)]
        mint: String,
        #[arg(long)]
        destination: String,
    },
    /// Show current fee configuration
    Show {
        #[arg(long)]
        mint: String,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let ctx = config::CliContext::new(&cli.rpc_url, &cli.keypair, &cli.commitment)?;

    match cli.command {
        Commands::Init {
            preset,
            mint,
            name,
            symbol,
            uri,
            decimals,
            supply_cap,
        } => commands::init::run(&ctx, &preset, &mint, &name, &symbol, &uri, decimals, supply_cap)?,
        Commands::Mint { mint, to, amount } => {
            commands::mint::run(&ctx, &mint, &to, amount)?;
        }
        Commands::Burn { mint, from, amount } => {
            commands::burn::run(&ctx, &mint, &from, amount)?;
        }
        Commands::Freeze { mint, account } => {
            commands::freeze::run(&ctx, &mint, &account)?;
        }
        Commands::Thaw { mint, account } => {
            commands::thaw::run(&ctx, &mint, &account)?;
        }
        Commands::Pause { mint, unpause } => {
            commands::pause::run(&ctx, &mint, unpause)?;
        }
        Commands::Seize {
            mint,
            from,
            to,
            amount,
        } => {
            commands::seize::run(&ctx, &mint, &from, &to, amount)?;
        }
        Commands::Info { mint } => {
            commands::info::run(&ctx, &mint)?;
        }
        Commands::Supply { mint } => {
            commands::supply::run(&ctx, &mint)?;
        }
        Commands::Blacklist { action } => match action {
            BlacklistAction::Add {
                mint,
                address,
                reason,
            } => commands::blacklist::add(&ctx, &mint, &address, &reason)?,
            BlacklistAction::Remove { mint, address } => {
                commands::blacklist::remove(&ctx, &mint, &address)?;
            }
            BlacklistAction::Check { mint, address } => {
                commands::blacklist::check(&ctx, &mint, &address)?;
            }
        },
        Commands::Roles { action } => match action {
            RolesAction::Grant {
                mint,
                address,
                role,
            } => commands::roles::grant(&ctx, &mint, &address, &role)?,
            RolesAction::Revoke {
                mint,
                address,
                role,
            } => commands::roles::revoke(&ctx, &mint, &address, &role)?,
            RolesAction::List { mint } => commands::roles::list(&ctx, &mint)?,
        },
        Commands::Minters { action } => match action {
            MintersAction::Add {
                mint,
                address,
                quota,
            } => commands::minters::add(&ctx, &mint, &address, quota)?,
            MintersAction::Remove { mint, address } => {
                commands::minters::remove(&ctx, &mint, &address)?;
            }
            MintersAction::List { mint } => commands::minters::list(&ctx, &mint)?,
        },
        Commands::Fees { action } => match action {
            FeesAction::Update { mint, bps, max_fee } => {
                commands::fees::update(&ctx, &mint, bps, max_fee)?;
            }
            FeesAction::Withdraw { mint, destination } => {
                commands::fees::withdraw(&ctx, &mint, &destination)?;
            }
            FeesAction::Show { mint } => commands::fees::show(&ctx, &mint)?,
        },
    }

    Ok(())
}
