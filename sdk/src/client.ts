import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionSignature,
  SendOptions,
  Signer,
} from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  Wallet,
  BN,
  setProvider,
} from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  Preset,
  Role,
  StablecoinInfo,
  RoleInfo,
  CreateStablecoinConfig,
  MintParams,
  BurnParams,
  SeizeParams,
  FeeConfig,
  SSS_CORE_PROGRAM_ID,
  SSS_TRANSFER_HOOK_PROGRAM_ID,
} from "./types";
import { deriveConfigPda, deriveRolePda, deriveBlacklistPda, deriveExtraAccountMetasPda } from "./pda";
import { translateError } from "./errors";
import { createSss1MintTransaction } from "./presets/sss1";
import { createSss2MintTransaction } from "./presets/sss2";
import { createSss3MintTransaction } from "./presets/sss3";
import { createSss4MintTransaction } from "./presets/sss4";
import * as coreIx from "./instructions/core";
import * as hookIx from "./instructions/hook";
import {
  createDepositInstruction,
  createApplyPendingBalanceInstruction,
} from "./confidential";

import sssCoreIdl from "./idl/sss_core.json";
import sssTransferHookIdl from "./idl/sss_transfer_hook.json";

export class SolanaStablecoin {
  public readonly connection: Connection;
  public readonly coreProgram: Program<any>;
  public readonly hookProgram: Program<any>;
  public readonly mint: PublicKey;
  public readonly configPda: PublicKey;
  public readonly configBump: number;

  private constructor(
    connection: Connection,
    coreProgram: Program<any>,
    hookProgram: Program<any>,
    mint: PublicKey,
    configPda: PublicKey,
    configBump: number
  ) {
    this.connection = connection;
    this.coreProgram = coreProgram;
    this.hookProgram = hookProgram;
    this.mint = mint;
    this.configPda = configPda;
    this.configBump = configBump;
  }

  // ── Factory Methods ───────────────────────────────────────────────────

  static initPrograms(
    connection: Connection,
    wallet: Wallet
  ): { core: Program<any>; hook: Program<any> } {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    setProvider(provider);

    const core = new Program(sssCoreIdl as any, provider);
    const hook = new Program(sssTransferHookIdl as any, provider);
    return { core, hook };
  }

  /**
   * Create a new stablecoin from scratch. This:
   * 1. Creates the Token-2022 mint with preset extensions
   * 2. Initializes the sss-core config
   * 3. For SSS-2/4, initializes the transfer hook extra account metas
   */
  static async create(
    connection: Connection,
    wallet: Wallet,
    config: CreateStablecoinConfig,
    signers?: Signer[]
  ): Promise<{
    stablecoin: SolanaStablecoin;
    mintKeypair: Keypair;
    signature: TransactionSignature;
  }> {
    const { core, hook } = SolanaStablecoin.initPrograms(connection, wallet);

    let mintTxResult: { transaction: Transaction; mintKeypair: Keypair };

    switch (config.preset) {
      case Preset.SSS_1:
        mintTxResult = await createSss1MintTransaction(connection, {
          payer: wallet.publicKey,
          name: config.name,
          symbol: config.symbol,
          uri: config.uri,
          decimals: config.decimals,
        });
        break;
      case Preset.SSS_2:
        mintTxResult = await createSss2MintTransaction(connection, {
          payer: wallet.publicKey,
          name: config.name,
          symbol: config.symbol,
          uri: config.uri,
          decimals: config.decimals,
        });
        break;
      case Preset.SSS_3:
        mintTxResult = await createSss3MintTransaction(connection, {
          payer: wallet.publicKey,
          name: config.name,
          symbol: config.symbol,
          uri: config.uri,
          decimals: config.decimals,
        });
        break;
      case Preset.SSS_4:
        mintTxResult = await createSss4MintTransaction(connection, {
          payer: wallet.publicKey,
          name: config.name,
          symbol: config.symbol,
          uri: config.uri,
          decimals: config.decimals,
          transferFeeBasisPoints: config.transferFeeBasisPoints ?? 100,
          maximumFee: BigInt(
            (config.maximumFee ?? new BN(1_000_000)).toString()
          ),
        });
        break;
      default:
        throw new Error(`Invalid preset: ${config.preset}`);
    }

    const { transaction: mintTx, mintKeypair } = mintTxResult;
    const [configPda, configBump] = deriveConfigPda(mintKeypair.publicKey);

    const initIx = await coreIx.buildInitializeIx(core, {
      authority: wallet.publicKey,
      mint: mintKeypair.publicKey,
      args: {
        preset: config.preset,
        name: config.name,
        symbol: config.symbol,
        uri: config.uri,
        decimals: config.decimals,
        supplyCap: config.supplyCap ?? null,
        enablePermanentDelegate: null,
        enableTransferHook: null,
        defaultAccountFrozen: null,
        oracleFeedId: config.oracleFeedId ?? null,
        transferFeeBasisPoints: config.transferFeeBasisPoints ?? null,
        maximumFee: config.maximumFee ?? null,
      },
    });

    mintTx.add(initIx);

    const needsHook =
      config.preset === Preset.SSS_2 || config.preset === Preset.SSS_4;

    if (needsHook) {
      const hookInitIx = await hookIx.buildInitializeExtraAccountMetasIx(
        hook,
        { payer: wallet.publicKey, mint: mintKeypair.publicKey }
      );
      mintTx.add(hookInitIx);
    }

    try {
      const sig = await sendAndConfirm(
        connection,
        wallet,
        mintTx,
        [mintKeypair, ...(signers ?? [])],
      );

      const stablecoin = new SolanaStablecoin(
        connection,
        core,
        hook,
        mintKeypair.publicKey,
        configPda,
        configBump
      );

      return { stablecoin, mintKeypair, signature: sig };
    } catch (e) {
      throw translateError(e);
    }
  }

  /**
   * Load an existing stablecoin by mint address.
   */
  static load(
    connection: Connection,
    wallet: Wallet,
    mint: PublicKey
  ): SolanaStablecoin {
    const { core, hook } = SolanaStablecoin.initPrograms(connection, wallet);
    const [configPda, configBump] = deriveConfigPda(mint);
    return new SolanaStablecoin(connection, core, hook, mint, configPda, configBump);
  }

  // ── Read Operations ───────────────────────────────────────────────────

  async getInfo(): Promise<StablecoinInfo> {
    const raw = await (this.coreProgram.account as any).stablecoinConfig.fetch(this.configPda);
    return parseConfig(raw, this.mint, this.configPda);
  }

  async getTotalSupply(): Promise<BN> {
    const info = await this.getInfo();
    return info.currentSupply;
  }

  async getRoleInfo(address: PublicKey, role: Role): Promise<RoleInfo | null> {
    const [rolePda] = deriveRolePda(this.configPda, address, role);
    try {
      const raw = await (this.coreProgram.account as any).roleAccount.fetch(rolePda);
      return {
        config: raw.config,
        address: raw.address,
        role: raw.role.admin
          ? Role.Admin
          : raw.role.minter
          ? Role.Minter
          : raw.role.freezer
          ? Role.Freezer
          : raw.role.pauser
          ? Role.Pauser
          : raw.role.burner
          ? Role.Burner
          : raw.role.blacklister
          ? Role.Blacklister
          : Role.Seizer,
        grantedBy: raw.grantedBy,
        grantedAt: raw.grantedAt,
        mintQuota: raw.mintQuota,
        amountMinted: raw.amountMinted,
      };
    } catch {
      return null;
    }
  }

  async isBlacklisted(address: PublicKey): Promise<boolean> {
    const [blacklistPda] = deriveBlacklistPda(this.mint, address);
    const account = await this.connection.getAccountInfo(blacklistPda);
    return account !== null && account.data.length > 0;
  }

  // ── Write Operations ──────────────────────────────────────────────────

  async mintTokens(params: MintParams): Promise<TransactionSignature> {
    const info = await this.getInfo();
    if (info.hasOracleFeed && !params.priceUpdate) {
      throw new Error(
        "Oracle is configured for this mint. Pass priceUpdate (Pyth PriceUpdateV2 account) in MintParams."
      );
    }

    const ata = getAssociatedTokenAddressSync(
      this.mint,
      params.recipient,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const tx = new Transaction();

    const ataInfo = await this.connection.getAccountInfo(ata);
    if (!ataInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          params.minter,
          ata,
          params.recipient,
          this.mint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    const ix = await coreIx.buildMintTokensIx(this.coreProgram, {
      minter: params.minter,
      mint: this.mint,
      to: ata,
      amount: params.amount,
      priceUpdate: params.priceUpdate ?? undefined,
    });
    tx.add(ix);

    return this.sendTx(tx);
  }

  async burnTokens(params: BurnParams): Promise<TransactionSignature> {
    const ix = await coreIx.buildBurnTokensIx(this.coreProgram, {
      burner: params.burner,
      mint: this.mint,
      from: params.from,
      amount: params.amount,
    });
    return this.sendTx(new Transaction().add(ix));
  }

  async freezeAccount(
    freezer: PublicKey,
    tokenAccount: PublicKey
  ): Promise<TransactionSignature> {
    const ix = await coreIx.buildFreezeAccountIx(this.coreProgram, {
      freezer,
      mint: this.mint,
      tokenAccount,
    });
    return this.sendTx(new Transaction().add(ix));
  }

  async thawAccount(
    freezer: PublicKey,
    tokenAccount: PublicKey
  ): Promise<TransactionSignature> {
    const ix = await coreIx.buildThawAccountIx(this.coreProgram, {
      freezer,
      mint: this.mint,
      tokenAccount,
    });
    return this.sendTx(new Transaction().add(ix));
  }

  async pause(pauser: PublicKey): Promise<TransactionSignature> {
    const ix = await coreIx.buildPauseIx(this.coreProgram, {
      pauser,
      configPda: this.configPda,
    });
    return this.sendTx(new Transaction().add(ix));
  }

  async unpause(pauser: PublicKey): Promise<TransactionSignature> {
    const ix = await coreIx.buildUnpauseIx(this.coreProgram, {
      pauser,
      configPda: this.configPda,
    });
    return this.sendTx(new Transaction().add(ix));
  }

  async seize(params: SeizeParams): Promise<TransactionSignature> {
    let remainingAccounts:
      | { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]
      | undefined;

    const info = await this.getInfo();
    if (info.enableTransferHook && params.fromOwner && params.toOwner) {
      const [extraMetasPda] = deriveExtraAccountMetasPda(this.mint);
      const [senderBlacklist] = deriveBlacklistPda(this.mint, params.fromOwner);
      const [receiverBlacklist] = deriveBlacklistPda(this.mint, params.toOwner);
      remainingAccounts = [
        { pubkey: SSS_TRANSFER_HOOK_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: extraMetasPda, isSigner: false, isWritable: false },
        { pubkey: senderBlacklist, isSigner: false, isWritable: false },
        { pubkey: receiverBlacklist, isSigner: false, isWritable: false },
      ];
    }

    const ix = await coreIx.buildSeizeIx(this.coreProgram, {
      seizer: params.seizer,
      mint: this.mint,
      from: params.from,
      to: params.to,
      amount: params.amount,
      remainingAccounts,
    });
    return this.sendTx(new Transaction().add(ix));
  }

  // ── Roles Namespace ───────────────────────────────────────────────────

  roles = {
    grant: async (
      admin: PublicKey,
      grantee: PublicKey,
      role: Role
    ): Promise<TransactionSignature> => {
      const ix = await coreIx.buildGrantRoleIx(this.coreProgram, {
        admin,
        configPda: this.configPda,
        grantee,
        role,
      });
      return this.sendTx(new Transaction().add(ix));
    },

    revoke: async (
      admin: PublicKey,
      address: PublicKey,
      role: Role
    ): Promise<TransactionSignature> => {
      const [roleAccount] = deriveRolePda(this.configPda, address, role);
      const ix = await coreIx.buildRevokeRoleIx(this.coreProgram, {
        admin,
        configPda: this.configPda,
        roleAccount,
      });
      return this.sendTx(new Transaction().add(ix));
    },

    proposeAuthority: async (
      admin: PublicKey,
      newAuthority: PublicKey
    ): Promise<TransactionSignature> => {
      const ix = await coreIx.buildProposeAuthorityIx(this.coreProgram, {
        admin,
        configPda: this.configPda,
        newAuthority,
      });
      return this.sendTx(new Transaction().add(ix));
    },

    acceptAuthority: async (
      newAuthority: PublicKey,
      oldAuthority: PublicKey
    ): Promise<TransactionSignature> => {
      const ix = await coreIx.buildAcceptAuthorityIx(this.coreProgram, {
        newAuthority,
        oldAuthority,
        configPda: this.configPda,
      });
      return this.sendTx(new Transaction().add(ix));
    },

    updateSupplyCap: async (
      admin: PublicKey,
      newCap: BN | null
    ): Promise<TransactionSignature> => {
      const ix = await coreIx.buildUpdateSupplyCapIx(this.coreProgram, {
        admin,
        configPda: this.configPda,
        newSupplyCap: newCap,
      });
      return this.sendTx(new Transaction().add(ix));
    },

    updateMinterQuota: async (
      admin: PublicKey,
      minter: PublicKey,
      newQuota: BN | null
    ): Promise<TransactionSignature> => {
      const [minterRole] = deriveRolePda(this.configPda, minter, Role.Minter);
      const ix = await coreIx.buildUpdateMinterIx(this.coreProgram, {
        admin,
        configPda: this.configPda,
        minterRole,
        newQuota,
      });
      return this.sendTx(new Transaction().add(ix));
    },
  };

  // ── Compliance Namespace ──────────────────────────────────────────────

  compliance = {
    blacklistAdd: async (
      authority: PublicKey,
      address: PublicKey,
      reason: string
    ): Promise<TransactionSignature> => {
      const ix = await hookIx.buildAddToBlacklistIx(this.hookProgram, {
        authority,
        mint: this.mint,
        address,
        reason,
      });
      return this.sendTx(new Transaction().add(ix));
    },

    blacklistRemove: async (
      authority: PublicKey,
      address: PublicKey
    ): Promise<TransactionSignature> => {
      const ix = await hookIx.buildRemoveFromBlacklistIx(this.hookProgram, {
        authority,
        mint: this.mint,
        address,
      });
      return this.sendTx(new Transaction().add(ix));
    },

    isBlacklisted: (address: PublicKey): Promise<boolean> => {
      return this.isBlacklisted(address);
    },
  };

  // ── Confidential Namespace (SSS-3) ──────────────────────────────────────

  confidential = {
    /**
     * Deposit tokens from public balance to pending confidential balance.
     * No ZK proofs required.
     */
    deposit: async (
      tokenAccount: PublicKey,
      amount: bigint,
      decimals: number
    ): Promise<TransactionSignature> => {
      const provider = this.coreProgram.provider as AnchorProvider;
      const owner = provider.publicKey;
      const ix = createDepositInstruction(
        tokenAccount,
        this.mint,
        owner,
        amount,
        decimals
      );
      return this.sendTx(new Transaction().add(ix));
    },

    /**
     * Apply pending confidential balance to available.
     * Requires expectedPendingBalanceCreditCounter (from on-chain state)
     * and newDecryptableAvailableBalance (36-byte ciphertext from AeKey.encrypt).
     * For full flow with key derivation, use `sss-token confidential apply-pending`.
     */
    applyPending: async (
      tokenAccount: PublicKey,
      expectedPendingBalanceCreditCounter: bigint,
      newDecryptableAvailableBalance: Uint8Array
    ): Promise<TransactionSignature> => {
      const provider = this.coreProgram.provider as AnchorProvider;
      const owner = provider.publicKey;
      const ix = createApplyPendingBalanceInstruction(
        tokenAccount,
        owner,
        expectedPendingBalanceCreditCounter,
        newDecryptableAvailableBalance
      );
      return this.sendTx(new Transaction().add(ix));
    },
  };

  // ── Fees Namespace (SSS-4) ────────────────────────────────────────────

  fees = {
    updateFee: async (
      admin: PublicKey,
      basisPoints: number,
      maximumFee: BN
    ): Promise<TransactionSignature> => {
      const ix = await coreIx.buildUpdateTransferFeeIx(this.coreProgram, {
        admin,
        mint: this.mint,
        newBasisPoints: basisPoints,
        newMaximumFee: maximumFee,
      });
      return this.sendTx(new Transaction().add(ix));
    },

    withdrawWithheld: async (
      admin: PublicKey,
      feeDestination: PublicKey,
      sources?: PublicKey[]
    ): Promise<TransactionSignature> => {
      const remainingAccounts = sources?.map((s) => ({
        pubkey: s,
        isSigner: false,
        isWritable: true,
      }));
      const ix = await coreIx.buildWithdrawWithheldIx(this.coreProgram, {
        admin,
        mint: this.mint,
        feeDestination,
        sources: remainingAccounts,
      });
      return this.sendTx(new Transaction().add(ix));
    },

    getConfig: async (): Promise<FeeConfig> => {
      const info = await this.getInfo();
      return {
        basisPoints: info.transferFeeBasisPoints,
        maximumFee: info.maximumFee,
      };
    },
  };

  // ── Helpers ───────────────────────────────────────────────────────────

  private async sendTx(
    tx: Transaction,
    extraSigners?: Signer[]
  ): Promise<TransactionSignature> {
    try {
      const provider = this.coreProgram.provider as AnchorProvider;
      if (extraSigners?.length) {
        tx.feePayer = provider.wallet.publicKey;
        tx.recentBlockhash = (
          await this.connection.getLatestBlockhash()
        ).blockhash;
        tx.partialSign(...extraSigners);
      }
      return await provider.sendAndConfirm!(tx, extraSigners, {
        commitment: "confirmed",
      });
    } catch (e) {
      throw translateError(e);
    }
  }
}

// ── Internal Helpers ──────────────────────────────────────────────────

async function sendAndConfirm(
  connection: Connection,
  wallet: Wallet,
  tx: Transaction,
  signers: Signer[]
): Promise<TransactionSignature> {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.partialSign(...signers);
  const signed = await wallet.signTransaction(tx);
  const rawTx = signed.serialize();
  const sig = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

function parseConfig(
  raw: any,
  mint: PublicKey,
  configPda: PublicKey
): StablecoinInfo {
  const nameBytes: number[] = raw.name;
  const symbolBytes: number[] = raw.symbol;

  const nameEnd = nameBytes.indexOf(0);
  const name = Buffer.from(nameBytes.slice(0, nameEnd === -1 ? 32 : nameEnd)).toString("utf8");
  const symbolEnd = symbolBytes.indexOf(0);
  const symbol = Buffer.from(symbolBytes.slice(0, symbolEnd === -1 ? 10 : symbolEnd)).toString("utf8");

  return {
    mint,
    config: configPda,
    authority: raw.authority,
    preset: raw.preset as Preset,
    name,
    symbol,
    decimals: raw.decimals,
    paused: raw.paused !== 0,
    supplyCap: raw.hasSupplyCap !== 0 ? new BN(raw.supplyCap) : null,
    totalMinted: new BN(raw.totalMinted),
    totalBurned: new BN(raw.totalBurned),
    currentSupply: new BN(raw.totalMinted).sub(new BN(raw.totalBurned)),
    enablePermanentDelegate: raw.enablePermanentDelegate !== 0,
    enableTransferHook: raw.enableTransferHook !== 0,
    defaultAccountFrozen: raw.defaultAccountFrozen !== 0,
    adminCount: raw.adminCount,
    hasOracleFeed: (raw.hasOracleFeed ?? raw.has_oracle_feed ?? 0) !== 0,
    transferFeeBasisPoints: raw.transferFeeBasisPoints,
    maximumFee: new BN(raw.maximumFee),
    hasPendingAuthority: raw.hasPendingAuthority !== 0,
    pendingAuthority: raw.pendingAuthority,
  };
}
