import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export enum Preset {
  SSS_1 = 1,
  SSS_2 = 2,
  SSS_3 = 3,
  SSS_4 = 4,
}

export enum Role {
  Admin = 0,
  Minter = 1,
  Freezer = 2,
  Pauser = 3,
  Burner = 4,
  Blacklister = 5,
  Seizer = 6,
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.Admin]: "Admin",
  [Role.Minter]: "Minter",
  [Role.Freezer]: "Freezer",
  [Role.Pauser]: "Pauser",
  [Role.Burner]: "Burner",
  [Role.Blacklister]: "Blacklister",
  [Role.Seizer]: "Seizer",
};

export interface CreateStablecoinConfig {
  preset: Preset;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  supplyCap?: BN;
  oracleFeedId?: number[];
  transferFeeBasisPoints?: number;
  maximumFee?: BN;
}

export interface StablecoinInfo {
  mint: PublicKey;
  config: PublicKey;
  authority: PublicKey;
  preset: Preset;
  name: string;
  symbol: string;
  decimals: number;
  paused: boolean;
  supplyCap: BN | null;
  totalMinted: BN;
  totalBurned: BN;
  currentSupply: BN;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
  adminCount: number;
  hasOracleFeed: boolean;
  transferFeeBasisPoints: number;
  maximumFee: BN;
  hasPendingAuthority: boolean;
  pendingAuthority: PublicKey;
}

export interface RoleInfo {
  config: PublicKey;
  address: PublicKey;
  role: Role;
  grantedBy: PublicKey;
  grantedAt: BN;
  mintQuota: BN | null;
  amountMinted: BN;
}

export interface BlacklistInfo {
  mint: PublicKey;
  address: PublicKey;
  addedBy: PublicKey;
  addedAt: BN;
  reason: string;
}

export interface MintParams {
  recipient: PublicKey;
  amount: BN;
  minter: PublicKey;
  /** Required when config.has_oracle_feed is set. Pyth PriceUpdateV2 account. */
  priceUpdate?: PublicKey | null;
}

export interface BurnParams {
  from: PublicKey;
  amount: BN;
  burner: PublicKey;
}

export interface SeizeParams {
  from: PublicKey;
  to: PublicKey;
  amount: BN;
  seizer: PublicKey;
  /** Required for SSS-2/SSS-4 (transfer hook mints): owner of the `from` token account */
  fromOwner?: PublicKey;
  /** Required for SSS-2/SSS-4 (transfer hook mints): owner of the `to` token account */
  toOwner?: PublicKey;
}

export interface FeeConfig {
  basisPoints: number;
  maximumFee: BN;
}

export const SSS_CORE_PROGRAM_ID = new PublicKey(
  "CoREsjH41J3KezywbudJC4gHqCE1QhNWaXRbC1QjA9ei"
);

export const SSS_TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  "HooKchDVVKm7GkAX4w75bbaQUbMcDUnYXSzqLZCWKCDH"
);

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);
