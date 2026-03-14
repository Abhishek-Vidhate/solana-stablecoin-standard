/**
 * Parse Token-2022 ConfidentialTransferAccount extension state.
 *
 * Use getExtensionData(ExtensionType.ConfidentialTransferAccount, mintInfo.tlvData)
 * to obtain the extension payload, then pass it here.
 *
 * Layout: approved(1), elgamal_pubkey(32), pending_balance_lo(64),
 * pending_balance_hi(64), available_balance(64), decryptable_available_balance(36),
 * allow_confidential_credits(1), allow_non_confidential_credits(1),
 * pending_balance_credit_counter(8), ...
 */

const LEN_BOOL = 1;
const LEN_ELGAMAL_PUBKEY = 32;
const LEN_ELGAMAL_CIPHERTEXT = 64;
const LEN_AE_CIPHERTEXT = 36;
const LEN_U64 = 8;

const OFF_APPROVED = 0;
const OFF_ELGAMAL_PUBKEY = OFF_APPROVED + LEN_BOOL;
const OFF_PENDING_BALANCE_LO = OFF_ELGAMAL_PUBKEY + LEN_ELGAMAL_PUBKEY;
const OFF_PENDING_BALANCE_HI = OFF_PENDING_BALANCE_LO + LEN_ELGAMAL_CIPHERTEXT;
const OFF_AVAILABLE_BALANCE = OFF_PENDING_BALANCE_HI + LEN_ELGAMAL_CIPHERTEXT;
const OFF_DECRYPTABLE_AVAILABLE_BALANCE =
  OFF_AVAILABLE_BALANCE + LEN_ELGAMAL_CIPHERTEXT;
const OFF_ALLOW_CONFIDENTIAL_CREDITS =
  OFF_DECRYPTABLE_AVAILABLE_BALANCE + LEN_AE_CIPHERTEXT;
const OFF_ALLOW_NON_CONFIDENTIAL_CREDITS = OFF_ALLOW_CONFIDENTIAL_CREDITS + LEN_BOOL;
const OFF_PENDING_BALANCE_CREDIT_COUNTER =
  OFF_ALLOW_NON_CONFIDENTIAL_CREDITS + LEN_BOOL;
const OFF_MAXIMUM_PENDING_BALANCE_CREDIT_COUNTER =
  OFF_PENDING_BALANCE_CREDIT_COUNTER + LEN_U64;
const OFF_EXPECTED_PENDING_BALANCE_CREDIT_COUNTER =
  OFF_MAXIMUM_PENDING_BALANCE_CREDIT_COUNTER + LEN_U64;
const OFF_ACTUAL_PENDING_BALANCE_CREDIT_COUNTER =
  OFF_EXPECTED_PENDING_BALANCE_CREDIT_COUNTER + LEN_U64;

export const CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH =
  OFF_ACTUAL_PENDING_BALANCE_CREDIT_COUNTER + LEN_U64;

export interface ParsedConfidentialTransferAccount {
  approved: boolean;
  elgamalPubkey: Uint8Array;
  pendingBalanceLo: Uint8Array;
  pendingBalanceHi: Uint8Array;
  availableBalance: Uint8Array;
  decryptableAvailableBalance: Uint8Array;
  allowConfidentialCredits: boolean;
  allowNonConfidentialCredits: boolean;
  pendingBalanceCreditCounter: bigint;
  maximumPendingBalanceCreditCounter: bigint;
  expectedPendingBalanceCreditCounter: bigint;
  actualPendingBalanceCreditCounter: bigint;
}

function readU64(data: Uint8Array, offset: number): bigint {
  const lo =
    data[offset]! |
    (data[offset + 1]! << 8) |
    (data[offset + 2]! << 16) |
    (data[offset + 3]! << 24);
  const hi =
    data[offset + 4]! |
    (data[offset + 5]! << 8) |
    (data[offset + 6]! << 16) |
    (data[offset + 7]! << 24);
  return BigInt(lo) + BigInt(hi) * 0x1_0000_0000n;
}

export function parseConfidentialTransferAccountState(
  data: Uint8Array
): ParsedConfidentialTransferAccount {
  if (data.length < CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH) {
    throw new Error(
      `ConfidentialTransferAccount data must be at least ${CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH} bytes, got ${data.length}`
    );
  }
  return {
    approved: data[OFF_APPROVED]! !== 0,
    elgamalPubkey: data.slice(
      OFF_ELGAMAL_PUBKEY,
      OFF_ELGAMAL_PUBKEY + LEN_ELGAMAL_PUBKEY
    ),
    pendingBalanceLo: data.slice(
      OFF_PENDING_BALANCE_LO,
      OFF_PENDING_BALANCE_LO + LEN_ELGAMAL_CIPHERTEXT
    ),
    pendingBalanceHi: data.slice(
      OFF_PENDING_BALANCE_HI,
      OFF_PENDING_BALANCE_HI + LEN_ELGAMAL_CIPHERTEXT
    ),
    availableBalance: data.slice(
      OFF_AVAILABLE_BALANCE,
      OFF_AVAILABLE_BALANCE + LEN_ELGAMAL_CIPHERTEXT
    ),
    decryptableAvailableBalance: data.slice(
      OFF_DECRYPTABLE_AVAILABLE_BALANCE,
      OFF_DECRYPTABLE_AVAILABLE_BALANCE + LEN_AE_CIPHERTEXT
    ),
    allowConfidentialCredits: data[OFF_ALLOW_CONFIDENTIAL_CREDITS]! !== 0,
    allowNonConfidentialCredits:
      data[OFF_ALLOW_NON_CONFIDENTIAL_CREDITS]! !== 0,
    pendingBalanceCreditCounter: readU64(
      data,
      OFF_PENDING_BALANCE_CREDIT_COUNTER
    ),
    maximumPendingBalanceCreditCounter: readU64(
      data,
      OFF_MAXIMUM_PENDING_BALANCE_CREDIT_COUNTER
    ),
    expectedPendingBalanceCreditCounter: readU64(
      data,
      OFF_EXPECTED_PENDING_BALANCE_CREDIT_COUNTER
    ),
    actualPendingBalanceCreditCounter: readU64(
      data,
      OFF_ACTUAL_PENDING_BALANCE_CREDIT_COUNTER
    ),
  };
}
