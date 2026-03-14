import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMetadataPointerInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeMint2Instruction,
  getMintLen,
  AuthorityType,
  createSetAuthorityInstruction,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
} from "@solana/spl-token-metadata";
import { deriveConfigPda } from "../pda";

/**
 * SSS-1: Minimal Stablecoin
 * Extensions: MetadataPointer, PermanentDelegate
 */
export function buildSss1MintInstructions(opts: {
  payer: PublicKey;
  mintKeypair: Keypair;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
}): { instructions: TransactionInstruction[]; mintKeypair: Keypair } {
  const { payer, mintKeypair, name, symbol, uri, decimals } = opts;
  const mint = mintKeypair.publicKey;
  const [configPda] = deriveConfigPda(mint);

  const extensions = [ExtensionType.MetadataPointer, ExtensionType.PermanentDelegate];
  const mintLen = getMintLen(extensions);

  const instructions: TransactionInstruction[] = [];

  // Allocate only mintLen for space (Token-2022 validates TLV at InitializeMint2).
  // Pre-fund lamports for the estimated final size including metadata,
  // since the metadata init instruction will reallocate the account.
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: mintLen,
      lamports: 0, // will be set by caller after getMinimumBalanceForRentExemption
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );

  instructions.push(
    createInitializeMetadataPointerInstruction(mint, payer, mint, TOKEN_2022_PROGRAM_ID)
  );

  instructions.push(
    createInitializePermanentDelegateInstruction(mint, configPda, TOKEN_2022_PROGRAM_ID)
  );

  instructions.push(
    createInitializeMint2Instruction(mint, decimals, payer, payer, TOKEN_2022_PROGRAM_ID)
  );

  instructions.push(
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint,
      updateAuthority: payer,
      mint,
      mintAuthority: payer,
      name,
      symbol,
      uri,
    })
  );

  instructions.push(
    createSetAuthorityInstruction(
      mint,
      payer,
      AuthorityType.MintTokens,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  instructions.push(
    createSetAuthorityInstruction(
      mint,
      payer,
      AuthorityType.FreezeAccount,
      configPda,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  return { instructions, mintKeypair };
}

export async function createSss1MintTransaction(
  connection: Connection,
  opts: {
    payer: PublicKey;
    mintKeypair?: Keypair;
    name: string;
    symbol: string;
    uri: string;
    decimals: number;
  }
): Promise<{ transaction: Transaction; mintKeypair: Keypair }> {
  const mintKeypair = opts.mintKeypair ?? Keypair.generate();
  const { instructions } = buildSss1MintInstructions({
    ...opts,
    mintKeypair,
  });

  const extensions = [ExtensionType.MetadataPointer, ExtensionType.PermanentDelegate];
  const mintLen = getMintLen(extensions);
  // Estimate metadata size for rent pre-funding (generous estimate)
  const estimatedMetadataLen = 256 + opts.name.length + opts.symbol.length + (opts.uri?.length ?? 0);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + estimatedMetadataLen);
  instructions[0] = SystemProgram.createAccount({
    fromPubkey: opts.payer,
    newAccountPubkey: mintKeypair.publicKey,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const transaction = new Transaction().add(...instructions);
  return { transaction, mintKeypair };
}

// Token-2022 metadata init automatically reallocates the account,
// so we no longer need to pre-calculate metadata space.
