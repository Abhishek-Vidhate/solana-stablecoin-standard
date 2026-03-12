/**
 * Unit tests for the confidential transfer SDK utilities.
 *
 * These tests verify instruction construction only — they do NOT send transactions.
 * Data layout specs from spl-token-2022 confidential transfer extension.
 */

import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  createDepositInstruction,
  createApplyPendingBalanceInstruction,
  generateTestElGamalKeypair,
  generateTestAesKey,
  deriveElGamalKeypair,
  parseConfidentialTransferAccountState,
  CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH,
  ConfidentialOps,
} from "../src/confidential";

const DUMMY_PUBKEY = new PublicKey("11111111111111111111111111111111");
const DUMMY_PUBKEY_2 = new PublicKey("So11111111111111111111111111111111111111112");

// ── keys.ts ─────────────────────────────────────────────────
describe("Confidential Transfer – keys", () => {
  it("generateTestElGamalKeypair returns 32-byte keys", () => {
    const { publicKey, secretKey } = generateTestElGamalKeypair();
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey.length).toBe(32);
    expect(secretKey).toBeInstanceOf(Uint8Array);
    expect(secretKey.length).toBe(32);
  });

  it("generateTestAesKey returns 16 bytes", () => {
    const key = generateTestAesKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(16);
  });

  it("deriveElGamalKeypair always throws (Rust-only)", () => {
    expect(() => deriveElGamalKeypair(null, null)).toThrow("solana-zk-sdk");
  });
});

// ── createDepositInstruction ─────────────────────────────────
// Data: [27, 5, amount(8 LE), decimals(1)] = 11 bytes
// Accounts: tokenAccount(writable), mint, owner(signer)
describe("Confidential Transfer – createDepositInstruction", () => {
  const AMOUNT = 100_000_000n;
  const DECIMALS = 6;

  const makeIx = () =>
    createDepositInstruction(DUMMY_PUBKEY, DUMMY_PUBKEY_2, DUMMY_PUBKEY, AMOUNT, DECIMALS);

  it("targets TOKEN_2022_PROGRAM_ID", () => {
    expect(makeIx().programId.toBase58()).toBe(TOKEN_2022_PROGRAM_ID.toBase58());
  });

  it("has exactly 3 account metas [tokenAccount, mint, owner]", () => {
    const ix = makeIx();
    expect(ix.keys.length).toBe(3);
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[1].isWritable).toBe(false);
    expect(ix.keys[2].isSigner).toBe(true);
  });

  it("data starts with [27, 5] (ConfidentialTransferExtension + Deposit)", () => {
    const ix = makeIx();
    expect(ix.data[0]).toBe(27);
    expect(ix.data[1]).toBe(5);
  });

  it("data is exactly 11 bytes", () => {
    expect(makeIx().data.length).toBe(11);
  });

  it("amount is encoded as PodU64 LE at bytes [2-9]", () => {
    const ix = makeIx();
    const data = ix.data as Buffer;
    const decoded = data.readBigUInt64LE(2);
    expect(decoded).toBe(AMOUNT);
  });

  it("decimals is encoded at byte [10]", () => {
    const ix = makeIx();
    expect((ix.data as Buffer).readUInt8(10)).toBe(DECIMALS);
  });
});

// ── createApplyPendingBalanceInstruction ──────────────────────
// Data: [27, 8, counter(8 LE), ciphertext(36)] = 46 bytes
// Accounts: tokenAccount(writable), owner(signer)
describe("Confidential Transfer – createApplyPendingBalanceInstruction", () => {
  const CREDIT_COUNTER = 3n;
  const CIPHERTEXT = new Uint8Array(36).fill(0xab);

  const makeIx = () =>
    createApplyPendingBalanceInstruction(DUMMY_PUBKEY, DUMMY_PUBKEY, CREDIT_COUNTER, CIPHERTEXT);

  it("targets TOKEN_2022_PROGRAM_ID", () => {
    expect(makeIx().programId.toBase58()).toBe(TOKEN_2022_PROGRAM_ID.toBase58());
  });

  it("has exactly 2 account metas [tokenAccount, owner]", () => {
    const ix = makeIx();
    expect(ix.keys.length).toBe(2);
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[1].isSigner).toBe(true);
  });

  it("data starts with [27, 8]", () => {
    const ix = makeIx();
    expect(ix.data[0]).toBe(27);
    expect(ix.data[1]).toBe(8);
  });

  it("data is exactly 46 bytes", () => {
    expect(makeIx().data.length).toBe(46);
  });

  it("credit counter is encoded as PodU64 LE at bytes [2-9]", () => {
    const ix = makeIx();
    const decoded = (ix.data as Buffer).readBigUInt64LE(2);
    expect(decoded).toBe(CREDIT_COUNTER);
  });

  it("ciphertext is encoded at bytes [10-45]", () => {
    const ix = makeIx();
    const ciphertextSlice = new Uint8Array(
      (ix.data as Buffer).buffer,
      (ix.data as Buffer).byteOffset + 10,
      36
    );
    expect(ciphertextSlice).toEqual(CIPHERTEXT);
  });

  it("throws when ciphertext is not 36 bytes", () => {
    expect(() =>
      createApplyPendingBalanceInstruction(DUMMY_PUBKEY, DUMMY_PUBKEY, 0n, new Uint8Array(16))
    ).toThrow("36 bytes");
  });
});

// ── ConfidentialOps ──────────────────────────────────────────
describe("Confidential Transfer – ConfidentialOps", () => {
  it("buildDepositInstruction produces valid instruction", () => {
    const ops = new ConfidentialOps(DUMMY_PUBKEY_2, DUMMY_PUBKEY);
    const ix = ops.buildDepositInstruction(DUMMY_PUBKEY, 1000n, 6);
    expect(ix.programId.toBase58()).toBe(TOKEN_2022_PROGRAM_ID.toBase58());
    expect(ix.data[0]).toBe(27);
    expect(ix.data[1]).toBe(5);
  });

  it("buildApplyPendingBalanceInstruction produces valid instruction", () => {
    const ops = new ConfidentialOps(DUMMY_PUBKEY_2, DUMMY_PUBKEY);
    const ciphertext = new Uint8Array(36).fill(0);
    const ix = ops.buildApplyPendingBalanceInstruction(DUMMY_PUBKEY, 1n, ciphertext);
    expect(ix.programId.toBase58()).toBe(TOKEN_2022_PROGRAM_ID.toBase58());
    expect(ix.data[0]).toBe(27);
    expect(ix.data[1]).toBe(8);
  });
});

// ── parseConfidentialTransferAccountState ─────────────────────
describe("Confidential Transfer – parseConfidentialTransferAccountState", () => {
  it("extension length is 295", () => {
    expect(CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH).toBe(295);
  });

  it("parses minimal valid buffer and returns expected fields", () => {
    const data = new Uint8Array(CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH);
    data[0] = 1; // approved
    data[261] = 1; // allow_confidential_credits
    data[262] = 1; // allow_non_confidential_credits
    data[263] = 5; // pending_balance_credit_counter (LE)
    const parsed = parseConfidentialTransferAccountState(data);
    expect(parsed.approved).toBe(true);
    expect(parsed.pendingBalanceCreditCounter).toBe(5n);
    expect(parsed.decryptableAvailableBalance.length).toBe(36);
    expect(parsed.pendingBalanceLo.length).toBe(64);
    expect(parsed.pendingBalanceHi.length).toBe(64);
    expect(parsed.elgamalPubkey.length).toBe(32);
  });

  it("throws when data is too short", () => {
    expect(() => parseConfidentialTransferAccountState(new Uint8Array(100))).toThrow(
      "at least 295"
    );
  });
});
