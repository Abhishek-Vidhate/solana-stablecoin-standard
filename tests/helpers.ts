import * as anchor from "@coral-xyz/anchor";
import { Program, BN, AnchorProvider } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  ExtensionType,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferHookInstruction,
  createInitializeDefaultAccountStateInstruction,
  createInitializeTransferFeeConfigInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  AccountState,
  createInitializeMint2Instruction,
} from "@solana/spl-token";
import {
  createInitializeInstruction as createInitializeMetadataInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";
import { SssCore } from "../target/types/sss_core";
import { SssTransferHook } from "../target/types/sss_transfer_hook";
import { initReporter, reportTransaction } from "./reporter";

export const CORE_PROGRAM_ID = new PublicKey(
  "CoREsjH41J3KezywbudJC4gHqCE1QhNWaXRbC1QjA9ei"
);
export const HOOK_PROGRAM_ID = new PublicKey(
  "HooKchDVVKm7GkAX4w75bbaQUbMcDUnYXSzqLZCWKCDH"
);

export const ROLE_ADMIN = 0;
export const ROLE_MINTER = 1;
export const ROLE_FREEZER = 2;
export const ROLE_PAUSER = 3;
export const ROLE_BURNER = 4;
export const ROLE_BLACKLISTER = 5;
export const ROLE_SEIZER = 6;

/** Call from test before() to enable transaction reporting. */
export function initReportConnection(connection: Connection, cluster = "localnet") {
  initReporter(connection, cluster);
}

/** Log a transaction for the report (only when REPORT=1). */
export function reportTx(suite: string, test: string, instruction: string, signature: string) {
  reportTransaction(suite, test, instruction, signature);
}

/** Serialize values for test output (BN, PublicKey, etc.). */
function serializeForLog(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof BN) return value.toString();
  if (value instanceof PublicKey) return value.toBase58();
  if (typeof value === "object" && value !== null && "toBase58" in value) return (value as PublicKey).toBase58();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeForLog);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeForLog(v);
    return out;
  }
  return value;
}

/** Log test input (params, accounts) for transparency. */
export function logInput(instruction: string, data: Record<string, unknown>) {
  const serialized = serializeForLog(data) as Record<string, unknown>;
  console.log("  [INPUT]   ", instruction);
  console.log("     ", JSON.stringify(serialized, null, 2));
}

/** Log test output (tx sig, state) for transparency. */
export function logOutput(instruction: string, data: Record<string, unknown>) {
  const serialized = serializeForLog(data) as Record<string, unknown>;
  console.log("  [OUTPUT]  ", instruction);
  console.log("     ", JSON.stringify(serialized, null, 2));
}

/** Log what is happening in a test step. */
export function logAction(description: string, data?: Record<string, unknown>) {
  if (data) {
    const serialized = serializeForLog(data) as Record<string, unknown>;
    console.log("  ⚙️  ACTION ", description);
    console.log("     ", JSON.stringify(serialized, null, 2));
  } else {
    console.log("  ⚙️  ACTION ", description);
  }
}

// ── PDA Derivation ──────────────────────────────────────────────────────

export function deriveConfigPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sss-config"), mint.toBuffer()],
    CORE_PROGRAM_ID
  );
}

export function deriveRolePda(
  config: PublicKey,
  address: PublicKey,
  role: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("sss-role"),
      config.toBuffer(),
      address.toBuffer(),
      Buffer.from([role]),
    ],
    CORE_PROGRAM_ID
  );
}

export function deriveBlacklistPda(
  mint: PublicKey,
  address: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("blacklist"), mint.toBuffer(), address.toBuffer()],
    HOOK_PROGRAM_ID
  );
}

export function deriveExtraAccountMetasPda(
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.toBuffer()],
    HOOK_PROGRAM_ID
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

export async function airdropSol(
  connection: Connection,
  pubkey: PublicKey,
  amount: number
): Promise<void> {
  const sig = await connection.requestAirdrop(pubkey, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

export async function createTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  const ix = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    owner,
    mint,
    TOKEN_2022_PROGRAM_ID
  );
  const tx = new Transaction().add(ix);
  await sendAndConfirmTransaction(connection, tx, [payer]);
  return ata;
}

export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<bigint> {
  const account = await getAccount(
    connection,
    tokenAccount,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );
  return account.amount;
}

export async function fetchConfig(
  program: Program<SssCore>,
  configPda: PublicKey
) {
  return program.account.stablecoinConfig.fetch(configPda);
}

export async function grantRole(
  program: Program<SssCore>,
  admin: Keypair,
  configPda: PublicKey,
  grantee: PublicKey,
  roleValue: number
): Promise<void> {
  const [adminRolePda] = deriveRolePda(configPda, admin.publicKey, ROLE_ADMIN);
  const [rolePda] = deriveRolePda(configPda, grantee, roleValue);

  await program.methods
    .grantRole(roleValue)
    .accountsPartial({
      admin: admin.publicKey,
      config: configPda,
      adminRole: adminRolePda,
      grantee: grantee,
      roleAccount: rolePda,
      systemProgram: SystemProgram.programId,
    })
    .signers([admin])
    .rpc();
}

// ── Mint Creation ───────────────────────────────────────────────────────

/**
 * Create SSS-1 mint without MetadataPointer/metadata (matches CLI approach).
 * Uses only PermanentDelegate. Core program stores name/symbol/uri in config.
 */
export async function createSss1Mint(
  provider: AnchorProvider,
  payer: Keypair,
  _name: string,
  _symbol: string,
  _uri: string,
  decimals: number
): Promise<Keypair> {
  const mint = Keypair.generate();
  const [configPda] = deriveConfigPda(mint.publicKey);
  const connection = provider.connection;

  const extensions = [ExtensionType.PermanentDelegate];
  const space = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializePermanentDelegateInstruction(
      mint.publicKey,
      configPda,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMint2Instruction(
      mint.publicKey,
      decimals,
      payer.publicKey,
      payer.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      mint.publicKey,
      payer.publicKey,
      AuthorityType.MintTokens,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      mint.publicKey,
      payer.publicKey,
      AuthorityType.FreezeAccount,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  return mint;
}

/**
 * Create SSS-2 mint without MetadataPointer/metadata (matches CLI approach).
 * Extensions: PermanentDelegate, TransferHook, DefaultAccountState.
 */
export async function createSss2Mint(
  provider: AnchorProvider,
  payer: Keypair,
  _name: string,
  _symbol: string,
  _uri: string,
  decimals: number
): Promise<Keypair> {
  const mint = Keypair.generate();
  const [configPda] = deriveConfigPda(mint.publicKey);
  const connection = provider.connection;

  const extensions = [
    ExtensionType.PermanentDelegate,
    ExtensionType.TransferHook,
    ExtensionType.DefaultAccountState,
  ];
  const space = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializePermanentDelegateInstruction(
      mint.publicKey,
      configPda,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeTransferHookInstruction(
      mint.publicKey,
      payer.publicKey,
      HOOK_PROGRAM_ID,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeDefaultAccountStateInstruction(
      mint.publicKey,
      AccountState.Frozen,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMint2Instruction(
      mint.publicKey,
      decimals,
      payer.publicKey,
      payer.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      mint.publicKey,
      payer.publicKey,
      AuthorityType.MintTokens,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      mint.publicKey,
      payer.publicKey,
      AuthorityType.FreezeAccount,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  return mint;
}

/**
 * Raw ConfidentialTransferMint init instruction.
 * Layout: discriminator(1) = 27, sub-ix(1) = 0, authority(32), autoApprove(1), auditorPk(32)
 */
function createConfidentialTransferMintInstruction(
  mint: PublicKey,
  authority: PublicKey,
  autoApprove: boolean
): TransactionInstruction {
  const data = Buffer.alloc(67);
  data.writeUInt8(27, 0); // ConfidentialTransfer extension discriminator
  data.writeUInt8(0, 1); // InitializeMint sub-instruction
  authority.toBuffer().copy(data, 2);
  data.writeUInt8(autoApprove ? 1 : 0, 34);
  Buffer.alloc(32).copy(data, 35); // Auditor ElGamal pubkey — all zeros (no auditor)

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [{ pubkey: mint, isSigner: false, isWritable: true }],
    data,
  });
}

/**
 * Create SSS-3 mint without MetadataPointer/metadata (matches CLI approach).
 * Extensions: PermanentDelegate, ConfidentialTransferMint.
 */
export async function createSss3Mint(
  provider: AnchorProvider,
  payer: Keypair,
  _name: string,
  _symbol: string,
  _uri: string,
  decimals: number
): Promise<Keypair> {
  const mint = Keypair.generate();
  const [configPda] = deriveConfigPda(mint.publicKey);
  const connection = provider.connection;

  const extensions = [
    ExtensionType.PermanentDelegate,
    ExtensionType.ConfidentialTransferMint,
  ];
  const space = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializePermanentDelegateInstruction(
      mint.publicKey,
      configPda,
      TOKEN_2022_PROGRAM_ID
    ),
    createConfidentialTransferMintInstruction(
      mint.publicKey,
      configPda,
      true
    ),
    createInitializeMint2Instruction(
      mint.publicKey,
      decimals,
      payer.publicKey,
      payer.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      mint.publicKey,
      payer.publicKey,
      AuthorityType.MintTokens,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      mint.publicKey,
      payer.publicKey,
      AuthorityType.FreezeAccount,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  return mint;
}

/**
 * Create SSS-4 mint without MetadataPointer/metadata (matches CLI approach).
 * Extensions: PermanentDelegate, TransferHook, DefaultAccountState, TransferFeeConfig.
 */
export async function createSss4Mint(
  provider: AnchorProvider,
  payer: Keypair,
  _name: string,
  _symbol: string,
  _uri: string,
  decimals: number,
  feeBps: number,
  maxFee: bigint
): Promise<Keypair> {
  const mint = Keypair.generate();
  const [configPda] = deriveConfigPda(mint.publicKey);
  const connection = provider.connection;

  const extensions = [
    ExtensionType.PermanentDelegate,
    ExtensionType.TransferHook,
    ExtensionType.DefaultAccountState,
    ExtensionType.TransferFeeConfig,
  ];
  const space = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializePermanentDelegateInstruction(
      mint.publicKey,
      configPda,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeTransferHookInstruction(
      mint.publicKey,
      payer.publicKey,
      HOOK_PROGRAM_ID,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeDefaultAccountStateInstruction(
      mint.publicKey,
      AccountState.Frozen,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeTransferFeeConfigInstruction(
      mint.publicKey,
      configPda,
      configPda,
      feeBps,
      maxFee,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMint2Instruction(
      mint.publicKey,
      decimals,
      payer.publicKey,
      payer.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      mint.publicKey,
      payer.publicKey,
      AuthorityType.MintTokens,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      mint.publicKey,
      payer.publicKey,
      AuthorityType.FreezeAccount,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  return mint;
}
