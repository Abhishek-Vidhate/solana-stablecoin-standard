use std::path::PathBuf;

use anyhow::{Context, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{commitment_config::CommitmentConfig, signature::Keypair, signer::Signer};

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
