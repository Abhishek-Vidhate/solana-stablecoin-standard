/**
 * Key utilities for SSS-3 confidential transfers.
 *
 * In production, ElGamal keypairs are derived deterministically from the
 * wallet using the twisted ElGamal scheme in `solana-zk-sdk` (Rust).
 * These helpers support testing and demos.
 */

import { randomBytes } from "crypto";

/**
 * Generate a random ElGamal-like keypair for testing/demo purposes.
 *
 * In production, use the `solana-zk-sdk` Rust crate to derive from the wallet.
 */
export function generateTestElGamalKeypair(): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  return {
    publicKey: new Uint8Array(randomBytes(32)),
    secretKey: new Uint8Array(randomBytes(32)),
  };
}

/**
 * Generate a random AES-128 key for testing/demo purposes.
 *
 * The confidential transfer extension uses AES for the decryptable balance.
 * In production, derive from the wallet via `solana-zk-sdk`.
 */
export function generateTestAesKey(): Uint8Array {
  return new Uint8Array(randomBytes(16));
}

/**
 * Derive an ElGamal keypair from a wallet signer.
 *
 * Requires the `solana-zk-sdk` Rust crate. Use the CLI `confidential configure-account`
 * or a Rust proof service for production.
 *
 * @throws Always throws – use CLI or Rust for key derivation
 */
export function deriveElGamalKeypair(
  _signer: unknown,
  _tokenAccount: unknown
): { publicKey: Uint8Array; secretKey: Uint8Array } {
  throw new Error(
    "ElGamal keypair derivation requires the solana-zk-sdk Rust crate. " +
      "Use generateTestElGamalKeypair() for testing, or sss-token confidential configure-account for production."
  );
}
