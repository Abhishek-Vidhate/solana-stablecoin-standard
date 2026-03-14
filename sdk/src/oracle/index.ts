/**
 * Oracle helpers for SSS stablecoins with Pyth price feeds.
 * Use these when minting tokens for oracle-configured mints (config.has_oracle_feed).
 *
 * FUTURE: Switchboard V2 support — add optional oracle_type (pyth | switchboard) in config
 * and CPI to Switchboard V2 feed when oracle_type=switchboard. See bounty bonus criteria.
 */
import BN from "bn.js";

/**
 * Converts a USD amount to token raw amount using the oracle price.
 * Formula: usdAmount / price * 10^decimals
 *
 * @param usdAmount - Amount in USD (e.g. 100.50)
 * @param price - Oracle price (e.g. 150.25 for SOL/USD)
 * @param decimals - Token decimals (e.g. 6)
 * @returns Raw token amount as BN (smallest units)
 */
export function convertUsdToRawAmount(
  usdAmount: number,
  price: number,
  decimals: number
): BN {
  if (price <= 0) {
    throw new Error("Price must be positive");
  }
  const raw = Math.floor((usdAmount / price) * Math.pow(10, decimals));
  return new BN(raw);
}

/**
 * Known Pyth price feed IDs (32-byte hex strings).
 * Use these when initializing a stablecoin with oracle_feed_id.
 * Verify IDs at https://docs.pyth.network/price-feeds/price-feeds
 *
 * To obtain a PriceUpdateV2 account for mint_tokens, use @pythnetwork/pyth-solana-receiver
 * or a relayer that posts price updates on-chain.
 */
export const PRICE_FEED_REGISTRY: Record<string, string> = {
  /** SOL/USD - Mainnet (verify at pyth.network) */
  "SOL/USD": "0x7f2cc9242905d11b6b9d97105d5628e9da9b63ae655070baf9baf53d7bd0d96d",
  /** ETH/USD - Mainnet */
  "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  /** USDC/USD - Mainnet (peg check) */
  "USDC/USD": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
};

/**
 * Get oracle feed ID as 32-byte array for initialize/update_oracle.
 *
 * @param feedKey - Key from PRICE_FEED_REGISTRY (e.g. "SOL/USD") or hex string
 * @returns 32-byte array for oracle_feed_id
 */
export function getOracleFeedIdBytes(feedKey: string): number[] {
  const hex =
    PRICE_FEED_REGISTRY[feedKey] ?? (feedKey.startsWith("0x") ? feedKey : null);
  if (!hex) {
    throw new Error(`Unknown feed: ${feedKey}. Use PRICE_FEED_REGISTRY keys or hex.`);
  }
  const clean = hex.replace(/^0x/, "");
  if (clean.length !== 64) {
    throw new Error("Feed ID must be 32 bytes (64 hex chars)");
  }
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}
