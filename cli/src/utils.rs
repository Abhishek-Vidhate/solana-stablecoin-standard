use anyhow::{bail, Result};
use colored::Colorize;
use solana_sdk::pubkey::Pubkey;

// ── PDA derivation ──────────────────────────────────────────────────

pub fn derive_config_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"sss-config", mint.as_ref()], &sss_core::ID)
}

pub fn derive_role_pda(config: &Pubkey, address: &Pubkey, role: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"sss-role", config.as_ref(), address.as_ref(), &[role]],
        &sss_core::ID,
    )
}

pub fn derive_blacklist_pda(mint: &Pubkey, address: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"blacklist", mint.as_ref(), address.as_ref()],
        &sss_transfer_hook::ID,
    )
}

pub fn derive_extra_account_metas_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"extra-account-metas", mint.as_ref()],
        &sss_transfer_hook::ID,
    )
}

// ── Parsing helpers ─────────────────────────────────────────────────

pub fn parse_pubkey(s: &str) -> Result<Pubkey> {
    s.parse::<Pubkey>()
        .map_err(|_| anyhow::anyhow!("Invalid base58 pubkey: {s}"))
}

pub fn parse_role(s: &str) -> Result<u8> {
    match s.to_lowercase().as_str() {
        "admin" => Ok(0),
        "minter" => Ok(1),
        "freezer" => Ok(2),
        "pauser" => Ok(3),
        "burner" => Ok(4),
        "blacklister" => Ok(5),
        "seizer" => Ok(6),
        other => bail!("Unknown role: {other}. Expected: admin, minter, freezer, pauser, burner, blacklister, seizer"),
    }
}

pub fn role_name(r: u8) -> &'static str {
    match r {
        0 => "Admin",
        1 => "Minter",
        2 => "Freezer",
        3 => "Pauser",
        4 => "Burner",
        5 => "Blacklister",
        6 => "Seizer",
        _ => "Unknown",
    }
}

pub fn parse_preset(s: &str) -> Result<u8> {
    match s.to_lowercase().as_str() {
        "sss-1" | "sss1" | "1" => Ok(1),
        "sss-2" | "sss2" | "2" => Ok(2),
        "sss-3" | "sss3" | "3" => Ok(3),
        "sss-4" | "sss4" | "4" => Ok(4),
        other => bail!("Unknown preset: {other}. Expected: sss-1, sss-2, sss-3, sss-4"),
    }
}

pub fn preset_name(p: u8) -> &'static str {
    match p {
        1 => "SSS-1 (Basic Stablecoin)",
        2 => "SSS-2 (Compliance Stablecoin)",
        3 => "SSS-3 (Yield-Bearing Stablecoin)",
        4 => "SSS-4 (Full-Featured Stablecoin)",
        _ => "Unknown",
    }
}

// ── Output helpers ──────────────────────────────────────────────────

pub fn print_success(msg: &str) {
    println!("{} {}", "✓".green().bold(), msg);
}

pub fn print_tx(sig: &str) {
    println!("  {} {}", "tx:".dimmed(), sig);
}

pub fn print_field(label: &str, value: &str) {
    println!("  {:<24} {}", format!("{label}:").dimmed(), value);
}

pub fn print_separator() {
    println!("{}", "─".repeat(60).dimmed());
}

pub fn format_amount(amount: u64, decimals: u8) -> String {
    if decimals == 0 {
        return amount.to_string();
    }
    let divisor = 10u64.pow(decimals as u32);
    let whole = amount / divisor;
    let frac = amount % divisor;
    format!("{whole}.{frac:0>width$}", width = decimals as usize)
}

// ── Config deserialization (zero-copy packed layout) ────────────────

/// Raw parsed fields from the on-chain StablecoinConfig account.
/// The struct is `repr(packed)`, so we read at exact byte offsets after
/// the 8-byte Anchor discriminator.
pub struct ParsedConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub preset: u8,
    pub paused: bool,
    pub has_supply_cap: bool,
    pub supply_cap: u64,
    pub total_minted: u64,
    pub total_burned: u64,
    #[allow(dead_code)]
    pub bump: u8,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    pub admin_count: u16,
    pub has_oracle_feed: bool,
    pub oracle_feed_id: [u8; 32],
    pub transfer_fee_basis_points: u16,
    pub maximum_fee: u64,
    pub has_pending_authority: bool,
    pub pending_authority: Pubkey,
}

impl ParsedConfig {
    pub fn current_supply(&self) -> u64 {
        self.total_minted.saturating_sub(self.total_burned)
    }
}

pub fn parse_config_account(data: &[u8]) -> Result<ParsedConfig> {
    if data.len() < 8 + 448 {
        bail!(
            "Config account data too short: {} bytes (expected >= {})",
            data.len(),
            8 + 448
        );
    }

    let d = &data[8..]; // skip Anchor discriminator
    let mut off = 0usize;

    let authority = Pubkey::try_from(&d[off..off + 32]).unwrap();
    off += 32;
    let mint = Pubkey::try_from(&d[off..off + 32]).unwrap();
    off += 32;
    let preset = d[off];
    off += 1;
    let paused = d[off] != 0;
    off += 1;
    let has_supply_cap = d[off] != 0;
    off += 1;
    let supply_cap = u64::from_le_bytes(d[off..off + 8].try_into().unwrap());
    off += 8;
    let total_minted = u64::from_le_bytes(d[off..off + 8].try_into().unwrap());
    off += 8;
    let total_burned = u64::from_le_bytes(d[off..off + 8].try_into().unwrap());
    off += 8;
    let bump = d[off];
    off += 1;

    let name = bytes_to_string(&d[off..off + 32]);
    off += 32;
    let symbol = bytes_to_string(&d[off..off + 10]);
    off += 10;
    let uri = bytes_to_string(&d[off..off + 200]);
    off += 200;

    let decimals = d[off];
    off += 1;
    let enable_permanent_delegate = d[off] != 0;
    off += 1;
    let enable_transfer_hook = d[off] != 0;
    off += 1;
    let default_account_frozen = d[off] != 0;
    off += 1;
    let admin_count = u16::from_le_bytes(d[off..off + 2].try_into().unwrap());
    off += 2;
    let has_oracle_feed = d[off] != 0;
    off += 1;
    let mut oracle_feed_id = [0u8; 32];
    oracle_feed_id.copy_from_slice(&d[off..off + 32]);
    off += 32;
    let transfer_fee_basis_points = u16::from_le_bytes(d[off..off + 2].try_into().unwrap());
    off += 2;
    let maximum_fee = u64::from_le_bytes(d[off..off + 8].try_into().unwrap());
    off += 8;
    let has_pending_authority = d[off] != 0;
    off += 1;
    let pending_authority = Pubkey::try_from(&d[off..off + 32]).unwrap();

    Ok(ParsedConfig {
        authority,
        mint,
        preset,
        paused,
        has_supply_cap,
        supply_cap,
        total_minted,
        total_burned,
        bump,
        name,
        symbol,
        uri,
        decimals,
        enable_permanent_delegate,
        enable_transfer_hook,
        default_account_frozen,
        admin_count,
        has_oracle_feed,
        oracle_feed_id,
        transfer_fee_basis_points,
        maximum_fee,
        has_pending_authority,
        pending_authority,
    })
}

fn bytes_to_string(b: &[u8]) -> String {
    let end = b.iter().position(|&c| c == 0).unwrap_or(b.len());
    String::from_utf8_lossy(&b[..end]).to_string()
}
