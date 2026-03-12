export { SolanaStablecoin } from "./client";
export {
  Preset,
  Preset as Presets,
  Role,
  ROLE_LABELS,
  SSS_CORE_PROGRAM_ID,
  SSS_TRANSFER_HOOK_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "./types";
export type {
  CreateStablecoinConfig,
  StablecoinInfo,
  RoleInfo,
  BlacklistInfo,
  MintParams,
  BurnParams,
  SeizeParams,
  FeeConfig,
} from "./types";
export {
  deriveConfigPda,
  deriveRolePda,
  deriveBlacklistPda,
  deriveExtraAccountMetasPda,
} from "./pda";
export { SssError, translateError } from "./errors";
export {
  createSss1MintTransaction,
  createSss2MintTransaction,
  createSss3MintTransaction,
  createSss4MintTransaction,
} from "./presets";
export * as instructions from "./instructions";
export * as oracle from "./oracle";
export {
  createDepositInstruction,
  createApplyPendingBalanceInstruction,
  ConfidentialOps,
  generateTestElGamalKeypair,
  generateTestAesKey,
  deriveElGamalKeypair,
  parseConfidentialTransferAccountState,
  CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH,
} from "./confidential";
export type { ParsedConfidentialTransferAccount } from "./confidential";

import { SolanaStablecoin as _SSS } from "./client";
export const SSS = _SSS;
