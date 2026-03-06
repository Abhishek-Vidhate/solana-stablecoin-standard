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
  const metadataLen = calcMetadataLen(name, symbol, uri, mint);
  const totalLen = mintLen + metadataLen;

  const instructions: TransactionInstruction[] = [];

  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: totalLen,
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
  const metadataLen = calcMetadataLen(opts.name, opts.symbol, opts.uri, mintKeypair.publicKey);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);
  instructions[0] = SystemProgram.createAccount({
    fromPubkey: opts.payer,
    newAccountPubkey: mintKeypair.publicKey,
    space: mintLen + metadataLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const transaction = new Transaction().add(...instructions);
  return { transaction, mintKeypair };
}

function calcMetadataLen(
  name: string,
  symbol: string,
  uri: string,
  mint: PublicKey
): number {
  const METADATA_BASE = 4 + 32 + 32 + 4 + 4 + 4 + 4;
  return METADATA_BASE + name.length + symbol.length + uri.length + mint.toBase58().length;
}
