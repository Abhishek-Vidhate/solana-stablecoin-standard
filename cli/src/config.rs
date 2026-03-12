use std::path::PathBuf;

use anyhow::{Context, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{commitment_config::CommitmentConfig, signature::Keypair, signer::Signer};

/// Config file format for default mint persistence (.sss-config.json).
#[derive(serde::Deserialize, serde::Serialize)]
pub struct SssConfigFile {
    pub mint: Option<String>,
}

/// Load default mint from .sss-config.json. Searches: SSS_CONFIG env, ./.sss-config.json, ~/.config/sss/sss-config.json.
pub fn load_default_mint() -> Option<String> {
    let paths: Vec<PathBuf> = [
        std::env::var("SSS_CONFIG").ok().map(PathBuf::from),
        Some(PathBuf::from(".sss-config.json")),
        dirs::config_dir().map(|d| d.join("sss").join("sss-config.json")),
    ]
    .into_iter()
    .flatten()
    .collect();

    for path in paths {
        if path.exists() {
            if let Ok(contents) = std::fs::read_to_string(&path) {
                if let Ok(cfg) = serde_json::from_str::<SssConfigFile>(&contents) {
                    return cfg.mint;
                }
            }
        }
    }
    None
}

/// Save mint to config file. Uses SSS_CONFIG env or ./.sss-config.json.
#[allow(dead_code)]
pub fn save_default_mint(mint: &str) -> Result<()> {
    let path = std::env::var("SSS_CONFIG")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(".sss-config.json"));

    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let cfg = SssConfigFile {
        mint: Some(mint.to_string()),
    };
    let contents = serde_json::to_string_pretty(&cfg)?;
    std::fs::write(&path, contents).with_context(|| format!("Failed to write config to {}", path.display()))?;
    Ok(())
}

pub struct CliContext {
    pub client: RpcClient,
    pub payer: Keypair,
}

impl CliContext {
    pub fn new(rpc_url: &str, keypair_path: &str, commitment: &str) -> Result<Self> {
        let commitment = match commitment {
            "processed" => CommitmentConfig::processed(),
            "confirmed" => CommitmentConfig::confirmed(),
            "finalized" => CommitmentConfig::finalized(),
            other => anyhow::bail!("Unknown commitment level: {other}"),
        };

        let client = RpcClient::new_with_commitment(rpc_url.to_string(), commitment);
        let payer = load_keypair(keypair_path)?;
        Ok(Self { client, payer })
    }

    pub fn payer_pubkey(&self) -> solana_sdk::pubkey::Pubkey {
        self.payer.pubkey()
    }
}

fn expand_tilde(path: &str) -> String {
    if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            return path.replacen('~', &home.to_string_lossy(), 1);
        }
    }
    path.to_string()
}

fn load_keypair(path: &str) -> Result<Keypair> {
    let expanded = expand_tilde(path);
    let full_path = PathBuf::from(&expanded);
    let data = std::fs::read_to_string(&full_path)
        .with_context(|| format!("Failed to read keypair from {}", full_path.display()))?;

    let bytes: Vec<u8> = serde_json::from_str(&data)
        .with_context(|| format!("Failed to parse keypair JSON from {}", full_path.display()))?;

    Keypair::try_from(bytes.as_slice())
        .map_err(|e| anyhow::anyhow!("Invalid keypair bytes from {}: {e}", full_path.display()))
}
