import { AnchorError } from "@coral-xyz/anchor";

export const SSS_ERROR_MAP: Record<number, string> = {
  6000: "Operations are paused",
  6001: "Operations are not paused",
  6002: "Supply cap exceeded",
  6003: "Unauthorized: missing required role",
  6004: "Invalid preset value (must be 1-4)",
  6005: "Cannot remove the last admin",
  6006: "Overflow in arithmetic operation",
  6007: "Mint mismatch",
  6008: "Invalid supply cap: must be >= current supply",
  6009: "Amount must be greater than zero",
  6010: "Invalid role value",
  6011: "Invalid oracle price feed data",
  6012: "Oracle price is stale or non-positive",
  6013: "Minter quota exceeded",
  6014: "Name exceeds maximum length of 32 characters",
  6015: "Symbol exceeds maximum length of 10 characters",
  6016: "URI exceeds maximum length of 200 characters",
  6017: "Instruction requires SSS-4 preset",
  6018: "Transfer fee basis points cannot exceed 10000",
  6019: "No pending authority transfer to accept",
  6020: "Signer does not match the pending authority",
};

export const HOOK_ERROR_MAP: Record<number, string> = {
  6000: "Sender is blacklisted",
  6001: "Receiver is blacklisted",
  6002: "Reason exceeds maximum length of 128 characters",
  6003: "Unauthorized: missing required role",
};

export class SssError extends Error {
  public readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "SssError";
    this.code = code;
  }
}

export function translateError(err: unknown): SssError | unknown {
  if (err instanceof AnchorError) {
    const code = err.error.errorCode.number;
    const msg = SSS_ERROR_MAP[code] ?? HOOK_ERROR_MAP[code] ?? err.error.errorMessage;
    return new SssError(code, msg);
  }
  return err;
}
