import * as anchor from "@coral-xyz/anchor";
import { Program, BN, AnchorProvider } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
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
 * Compute mint account space for Token-2022 with metadata embedded.
 * Token-2022 metadata pointer stores metadata directly on the mint.
 */
function computeMintSpace(
  extensions: ExtensionType[],
  metadata: TokenMetadata
): number {
  const mintLen = getMintLen(extensions);
  const metadataLen = pack(metadata).length;
  // TYPE_SIZE(2) + LENGTH_SIZE(2) + metadata bytes
  return mintLen + 2 + 2 + metadataLen;
}

export async function createSss1Mint(
  provider: AnchorProvider,
  payer: Keypair,
  name: string,
  symbol: string,
  uri: string,
  decimals: number
): Promise<Keypair> {
  const mint = Keypair.generate();
  const [configPda] = deriveConfigPda(mint.publicKey);
  const connection = provider.connection;

  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
  ];

  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name,
    symbol,
    uri,
    additionalMetadata: [],
    updateAuthority: payer.publicKey,
  };

  const space = computeMintSpace(extensions, metadata);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      payer.publicKey,
      mint.publicKey, // metadata stored on mint itself
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializePermanentDelegateInstruction(
      mint.publicKey,
      configPda,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMint2Instruction(
      mint.publicKey,
      decimals,
      payer.publicKey, // initial mint authority
      payer.publicKey, // initial freeze authority
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMetadataInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint.publicKey,
      metadata: mint.publicKey,
      mintAuthority: payer.publicKey,
      name,
      symbol,
      uri,
      updateAuthority: payer.publicKey,
    }),
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

export async function createSss2Mint(
  provider: AnchorProvider,
  payer: Keypair,
  name: string,
  symbol: string,
  uri: string,
  decimals: number
): Promise<Keypair> {
  const mint = Keypair.generate();
  const [configPda] = deriveConfigPda(mint.publicKey);
  const connection = provider.connection;

  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
    ExtensionType.TransferHook,
    ExtensionType.DefaultAccountState,
  ];

  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name,
    symbol,
    uri,
    additionalMetadata: [],
    updateAuthority: payer.publicKey,
  };

  const space = computeMintSpace(extensions, metadata);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      payer.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
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
    createInitializeMetadataInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint.publicKey,
      metadata: mint.publicKey,
      mintAuthority: payer.publicKey,
      name,
      symbol,
      uri,
      updateAuthority: payer.publicKey,
    }),
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

export async function createSss4Mint(
  provider: AnchorProvider,
  payer: Keypair,
  name: string,
  symbol: string,
  uri: string,
  decimals: number,
  feeBps: number,
  maxFee: bigint
): Promise<Keypair> {
  const mint = Keypair.generate();
  const [configPda] = deriveConfigPda(mint.publicKey);
  const connection = provider.connection;

  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
    ExtensionType.TransferHook,
    ExtensionType.DefaultAccountState,
    ExtensionType.TransferFeeConfig,
  ];

  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name,
    symbol,
    uri,
    additionalMetadata: [],
    updateAuthority: payer.publicKey,
  };

  const space = computeMintSpace(extensions, metadata);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      payer.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
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
    createInitializeMetadataInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint.publicKey,
      metadata: mint.publicKey,
      mintAuthority: payer.publicKey,
      name,
      symbol,
      uri,
      updateAuthority: payer.publicKey,
    }),
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
