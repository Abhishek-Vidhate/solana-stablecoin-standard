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
} from "@solana/spl-token-metadata";
import { deriveConfigPda } from "../pda";

/**
 * SSS-3: Private Stablecoin (Confidential Transfers)
 * Extensions: MetadataPointer, PermanentDelegate, ConfidentialTransferMint
 *
 * NOTE: ConfidentialTransferMint does not have a high-level helper in @solana/spl-token yet.
 * We construct the raw instruction manually using the known layout.
 */
export async function createSss3MintTransaction(
  connection: Connection,
  opts: {
    payer: PublicKey;
    mintKeypair?: Keypair;
    name: string;
    symbol: string;
    uri: string;
    decimals: number;
    confidentialAuthority?: PublicKey;
    autoApprove?: boolean;
  }
): Promise<{ transaction: Transaction; mintKeypair: Keypair }> {
  const mintKeypair = opts.mintKeypair ?? Keypair.generate();
  const mint = mintKeypair.publicKey;
  const [configPda] = deriveConfigPda(mint);
  const { payer, name, symbol, uri, decimals } = opts;

  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
    ExtensionType.ConfidentialTransferMint,
  ];
  const mintLen = getMintLen(extensions);
  // Estimate metadata size for rent pre-funding (generous estimate)
  const estimatedMetadataLen = 256 + name.length + symbol.length + (uri?.length ?? 0);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + estimatedMetadataLen);

  const instructions: TransactionInstruction[] = [];

  // Allocate only mintLen for space; Token-2022 metadata init will auto-reallocate
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: mintLen,
      lamports,
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
    createConfidentialTransferMintInstruction(
      mint,
      opts.confidentialAuthority ?? configPda,
      opts.autoApprove ?? true
    )
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

  const transaction = new Transaction().add(...instructions);
  return { transaction, mintKeypair };
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
  // Auditor ElGamal pubkey — set to all zeros (no auditor)
  Buffer.alloc(32).copy(data, 35);

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [{ pubkey: mint, isSigner: false, isWritable: true }],
    data,
  });
}

// Token-2022 metadata init automatically reallocates the account.
