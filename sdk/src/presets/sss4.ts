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
  createInitializeTransferHookInstruction,
  createInitializeDefaultAccountStateInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeMint2Instruction,
  getMintLen,
  AuthorityType,
  createSetAuthorityInstruction,
  AccountState,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
} from "@solana/spl-token-metadata";
import { deriveConfigPda } from "../pda";
import { SSS_TRANSFER_HOOK_PROGRAM_ID } from "../types";

/**
 * SSS-4: Monetized Stablecoin (Transfer Fees)
 * Extensions: MetadataPointer, PermanentDelegate, TransferHook,
 *             DefaultAccountState(Frozen), TransferFeeConfig
 */
export async function createSss4MintTransaction(
  connection: Connection,
  opts: {
    payer: PublicKey;
    mintKeypair?: Keypair;
    name: string;
    symbol: string;
    uri: string;
    decimals: number;
    transferFeeBasisPoints: number;
    maximumFee: bigint;
  }
): Promise<{ transaction: Transaction; mintKeypair: Keypair }> {
  const mintKeypair = opts.mintKeypair ?? Keypair.generate();
  const mint = mintKeypair.publicKey;
  const [configPda] = deriveConfigPda(mint);
  const { payer, name, symbol, uri, decimals } = opts;

  const extensions = [
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
    ExtensionType.TransferHook,
    ExtensionType.DefaultAccountState,
    ExtensionType.TransferFeeConfig,
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
    createInitializeTransferHookInstruction(
      mint,
      payer,
      SSS_TRANSFER_HOOK_PROGRAM_ID,
      TOKEN_2022_PROGRAM_ID
    )
  );
  instructions.push(
    createInitializeDefaultAccountStateInstruction(
      mint,
      AccountState.Frozen,
      TOKEN_2022_PROGRAM_ID
    )
  );
  instructions.push(
    createInitializeTransferFeeConfigInstruction(
      mint,
      configPda,
      configPda,
      opts.transferFeeBasisPoints,
      opts.maximumFee,
      TOKEN_2022_PROGRAM_ID
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

// Token-2022 metadata init automatically reallocates the account.
