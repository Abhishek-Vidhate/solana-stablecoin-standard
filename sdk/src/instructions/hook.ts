import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { deriveBlacklistPda, deriveExtraAccountMetasPda, deriveConfigPda, deriveRolePda } from "../pda";
import { Role, SSS_CORE_PROGRAM_ID } from "../types";

type HookProgram = Program<any>;

function m(program: HookProgram): any {
  return program.methods;
}

export function buildInitializeExtraAccountMetasIx(
  program: HookProgram,
  opts: {
    payer: PublicKey;
    mint: PublicKey;
  }
): Promise<TransactionInstruction> {
  const [extraAccountMetas] = deriveExtraAccountMetasPda(opts.mint);

  return m(program)
    .initializeExtraAccountMetas()
    .accounts({
      payer: opts.payer,
      extraAccountMetas,
      mint: opts.mint,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function buildAddToBlacklistIx(
  program: HookProgram,
  opts: {
    authority: PublicKey;
    mint: PublicKey;
    address: PublicKey;
    reason: string;
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint, SSS_CORE_PROGRAM_ID);
  const [blacklisterRole] = deriveRolePda(configPda, opts.authority, Role.Blacklister);
  const [blacklistEntry] = deriveBlacklistPda(opts.mint, opts.address);

  return m(program)
    .addToBlacklist(opts.reason)
    .accounts({
      blacklister: opts.authority,
      blacklisterRole,
      mint: opts.mint,
      address: opts.address,
      blacklistEntry,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function buildRemoveFromBlacklistIx(
  program: HookProgram,
  opts: {
    authority: PublicKey;
    mint: PublicKey;
    address: PublicKey;
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint, SSS_CORE_PROGRAM_ID);
  const [blacklisterRole] = deriveRolePda(configPda, opts.authority, Role.Blacklister);
  const [blacklistEntry] = deriveBlacklistPda(opts.mint, opts.address);

  return m(program)
    .removeFromBlacklist()
    .accounts({
      blacklister: opts.authority,
      blacklisterRole,
      mint: opts.mint,
      blacklistEntry,
    })
    .instruction();
}
