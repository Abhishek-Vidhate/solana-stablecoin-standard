/**
 * SSS-3 confidential transfer operations.
 *
 * Token-2022's ConfidentialTransferExtension encrypts token balances using twisted
 * ElGamal. Deposit and ApplyPendingBalance (with caller-provided params) do NOT
 * require ZK proofs. Full transfer/withdraw require solana-zk-sdk (use CLI).
 */

import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export {
  generateTestElGamalKeypair,
  generateTestAesKey,
  deriveElGamalKeypair,
} from "./keys";

export {
  parseConfidentialTransferAccountState,
  CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH,
} from "./account-state";
export type { ParsedConfidentialTransferAccount } from "./account-state";

const CONFIDENTIAL_TRANSFER_EXTENSION_IX = 27;
const DEPOSIT = 5;
const APPLY_PENDING_BALANCE = 8;

/**
 * Build Token-2022 ConfidentialTransferExtension::Deposit instruction.
 *
 * Moves tokens from public balance to pending confidential balance.
 * No ZK proofs required.
 *
 * Data layout: [27, 5, amount(8 LE), decimals(1)]
 * Accounts: token_account(writable), mint, owner(signer)
 */
export function createDepositInstruction(
  tokenAccount: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number
): TransactionInstruction {
  const data = Buffer.alloc(11);
  data.writeUInt8(CONFIDENTIAL_TRANSFER_EXTENSION_IX, 0);
  data.writeUInt8(DEPOSIT, 1);
  data.writeBigUInt64LE(amount, 2);
  data.writeUInt8(decimals, 10);

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/**
 * Build Token-2022 ConfidentialTransferExtension::ApplyPendingBalance instruction.
 *
 * Credits pending confidential balance into available. Caller must provide:
 * - expectedPendingBalanceCreditCounter: from on-chain state (use parseConfidentialTransferAccountState)
 * - newDecryptableAvailableBalance: 36-byte PodAeCiphertext from AeKey.encrypt(newBalance)
 *
 * For full flow with key derivation, use `sss-token confidential apply-pending`.
 *
 * Data layout: [27, 8, counter(8 LE), ciphertext(36)]
 * Accounts: token_account(writable), owner(signer)
 */
export function createApplyPendingBalanceInstruction(
  tokenAccount: PublicKey,
  owner: PublicKey,
  expectedPendingBalanceCreditCounter: bigint,
  newDecryptableAvailableBalance: Uint8Array
): TransactionInstruction {
  if (newDecryptableAvailableBalance.length !== 36) {
    throw new Error(
      `newDecryptableAvailableBalance must be 36 bytes, got ${newDecryptableAvailableBalance.length}`
    );
  }

  const data = Buffer.alloc(46);
  data.writeUInt8(CONFIDENTIAL_TRANSFER_EXTENSION_IX, 0);
  data.writeUInt8(APPLY_PENDING_BALANCE, 1);
  data.writeBigUInt64LE(expectedPendingBalanceCreditCounter, 2);
  Buffer.from(newDecryptableAvailableBalance).copy(data, 10);

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/**
 * Builder for SSS-3 confidential operations (deposit, apply-pending).
 *
 * Transfer and withdraw require ZK proofs — use `sss-token confidential` CLI.
 */
export class ConfidentialOps {
  constructor(
    private _mint: PublicKey,
    private _owner: PublicKey
  ) {}

  buildDepositInstruction(
    tokenAccount: PublicKey,
    amount: bigint,
    decimals: number
  ): TransactionInstruction {
    return createDepositInstruction(
      tokenAccount,
      this._mint,
      this._owner,
      amount,
      decimals
    );
  }

  buildApplyPendingBalanceInstruction(
    tokenAccount: PublicKey,
    expectedPendingBalanceCreditCounter: bigint,
    newDecryptableAvailableBalance: Uint8Array
  ): TransactionInstruction {
    return createApplyPendingBalanceInstruction(
      tokenAccount,
      this._owner,
      expectedPendingBalanceCreditCounter,
      newDecryptableAvailableBalance
    );
  }
}
