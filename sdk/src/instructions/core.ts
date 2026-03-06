import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { deriveConfigPda, deriveRolePda } from "../pda";
import { Role } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type CoreProgram = Program<any>;

// Helper to access program methods without deep type instantiation
function m(program: CoreProgram): any {
  return program.methods;
}

export async function buildInitializeIx(
  program: CoreProgram,
  opts: {
    authority: PublicKey;
    mint: PublicKey;
    args: {
      preset: number;
      name: string;
      symbol: string;
      uri: string;
      decimals: number;
      supplyCap: BN | null;
      enablePermanentDelegate: boolean | null;
      enableTransferHook: boolean | null;
      defaultAccountFrozen: boolean | null;
      oracleFeedId: number[] | null;
      transferFeeBasisPoints: number | null;
      maximumFee: BN | null;
    };
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint);
  const [adminRole] = deriveRolePda(configPda, opts.authority, Role.Admin);

  return m(program)
    .initialize(opts.args)
    .accounts({
      authority: opts.authority,
      config: configPda,
      mint: opts.mint,
      adminRole,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function buildMintTokensIx(
  program: CoreProgram,
  opts: {
    minter: PublicKey;
    mint: PublicKey;
    to: PublicKey;
    amount: BN;
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint);
  const [minterRole] = deriveRolePda(configPda, opts.minter, Role.Minter);

  return m(program)
    .mintTokens(opts.amount)
    .accounts({
      minter: opts.minter,
      config: configPda,
      minterRole,
      mint: opts.mint,
      to: opts.to,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

export function buildBurnTokensIx(
  program: CoreProgram,
  opts: {
    burner: PublicKey;
    mint: PublicKey;
    from: PublicKey;
    amount: BN;
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint);
  const [burnerRole] = deriveRolePda(configPda, opts.burner, Role.Burner);

  return m(program)
    .burnTokens(opts.amount)
    .accounts({
      burner: opts.burner,
      config: configPda,
      burnerRole,
      mint: opts.mint,
      from: opts.from,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

export function buildFreezeAccountIx(
  program: CoreProgram,
  opts: {
    freezer: PublicKey;
    mint: PublicKey;
    tokenAccount: PublicKey;
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint);
  const [freezerRole] = deriveRolePda(configPda, opts.freezer, Role.Freezer);

  return m(program)
    .freezeAccount()
    .accounts({
      freezer: opts.freezer,
      config: configPda,
      freezerRole,
      mint: opts.mint,
      tokenAccount: opts.tokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

export function buildThawAccountIx(
  program: CoreProgram,
  opts: {
    freezer: PublicKey;
    mint: PublicKey;
    tokenAccount: PublicKey;
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint);
  const [freezerRole] = deriveRolePda(configPda, opts.freezer, Role.Freezer);

  return m(program)
    .thawAccount()
    .accounts({
      freezer: opts.freezer,
      config: configPda,
      freezerRole,
      mint: opts.mint,
      tokenAccount: opts.tokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

export function buildPauseIx(
  program: CoreProgram,
  opts: { pauser: PublicKey; configPda: PublicKey }
): Promise<TransactionInstruction> {
  const [pauserRole] = deriveRolePda(opts.configPda, opts.pauser, Role.Pauser);

  return m(program)
    .pause()
    .accounts({
      pauser: opts.pauser,
      config: opts.configPda,
      pauserRole,
    })
    .instruction();
}

export function buildUnpauseIx(
  program: CoreProgram,
  opts: { pauser: PublicKey; configPda: PublicKey }
): Promise<TransactionInstruction> {
  const [pauserRole] = deriveRolePda(opts.configPda, opts.pauser, Role.Pauser);

  return m(program)
    .unpause()
    .accounts({
      pauser: opts.pauser,
      config: opts.configPda,
      pauserRole,
    })
    .instruction();
}

export function buildSeizeIx(
  program: CoreProgram,
  opts: {
    seizer: PublicKey;
    mint: PublicKey;
    from: PublicKey;
    to: PublicKey;
    amount: BN;
    remainingAccounts?: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint);
  const [seizerRole] = deriveRolePda(configPda, opts.seizer, Role.Seizer);

  let builder = m(program)
    .seize(opts.amount)
    .accounts({
      seizer: opts.seizer,
      config: configPda,
      seizerRole,
      mint: opts.mint,
      from: opts.from,
      to: opts.to,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

  if (opts.remainingAccounts?.length) {
    builder = builder.remainingAccounts(opts.remainingAccounts);
  }

  return builder.instruction();
}

export function buildGrantRoleIx(
  program: CoreProgram,
  opts: {
    admin: PublicKey;
    configPda: PublicKey;
    grantee: PublicKey;
    role: Role;
  }
): Promise<TransactionInstruction> {
  const [adminRole] = deriveRolePda(opts.configPda, opts.admin, Role.Admin);
  const [roleAccount] = deriveRolePda(opts.configPda, opts.grantee, opts.role);

  return m(program)
    .grantRole(opts.role)
    .accounts({
      admin: opts.admin,
      config: opts.configPda,
      adminRole,
      grantee: opts.grantee,
      roleAccount,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function buildRevokeRoleIx(
  program: CoreProgram,
  opts: {
    admin: PublicKey;
    configPda: PublicKey;
    roleAccount: PublicKey;
  }
): Promise<TransactionInstruction> {
  const [adminRole] = deriveRolePda(opts.configPda, opts.admin, Role.Admin);

  return m(program)
    .revokeRole()
    .accounts({
      admin: opts.admin,
      config: opts.configPda,
      adminRole,
      roleAccount: opts.roleAccount,
    })
    .instruction();
}

export function buildProposeAuthorityIx(
  program: CoreProgram,
  opts: {
    admin: PublicKey;
    configPda: PublicKey;
    newAuthority: PublicKey;
  }
): Promise<TransactionInstruction> {
  const [adminRole] = deriveRolePda(opts.configPda, opts.admin, Role.Admin);

  return m(program)
    .proposeAuthority()
    .accounts({
      admin: opts.admin,
      config: opts.configPda,
      adminRole,
      newAuthority: opts.newAuthority,
    })
    .instruction();
}

export function buildAcceptAuthorityIx(
  program: CoreProgram,
  opts: {
    newAuthority: PublicKey;
    oldAuthority: PublicKey;
    configPda: PublicKey;
  }
): Promise<TransactionInstruction> {
  const [oldAdminRole] = deriveRolePda(opts.configPda, opts.oldAuthority, Role.Admin);
  const [newAdminRole] = deriveRolePda(opts.configPda, opts.newAuthority, Role.Admin);

  return m(program)
    .acceptAuthority()
    .accounts({
      newAuthority: opts.newAuthority,
      oldAuthority: opts.oldAuthority,
      config: opts.configPda,
      oldAdminRole,
      newAdminRole,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function buildUpdateSupplyCapIx(
  program: CoreProgram,
  opts: {
    admin: PublicKey;
    configPda: PublicKey;
    newSupplyCap: BN | null;
  }
): Promise<TransactionInstruction> {
  const [adminRole] = deriveRolePda(opts.configPda, opts.admin, Role.Admin);

  return m(program)
    .updateSupplyCap(opts.newSupplyCap)
    .accounts({
      admin: opts.admin,
      config: opts.configPda,
      adminRole,
    })
    .instruction();
}

export function buildUpdateMinterIx(
  program: CoreProgram,
  opts: {
    admin: PublicKey;
    configPda: PublicKey;
    minterRole: PublicKey;
    newQuota: BN | null;
  }
): Promise<TransactionInstruction> {
  const [adminRole] = deriveRolePda(opts.configPda, opts.admin, Role.Admin);

  return m(program)
    .updateMinter(opts.newQuota)
    .accounts({
      admin: opts.admin,
      config: opts.configPda,
      adminRole,
      minterRole: opts.minterRole,
    })
    .instruction();
}

export function buildUpdateTransferFeeIx(
  program: CoreProgram,
  opts: {
    admin: PublicKey;
    mint: PublicKey;
    newBasisPoints: number;
    newMaximumFee: BN;
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint);
  const [adminRole] = deriveRolePda(configPda, opts.admin, Role.Admin);

  return m(program)
    .updateTransferFee(opts.newBasisPoints, opts.newMaximumFee)
    .accounts({
      admin: opts.admin,
      config: configPda,
      adminRole,
      mint: opts.mint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

export function buildWithdrawWithheldIx(
  program: CoreProgram,
  opts: {
    admin: PublicKey;
    mint: PublicKey;
    feeDestination: PublicKey;
    sources?: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  }
): Promise<TransactionInstruction> {
  const [configPda] = deriveConfigPda(opts.mint);
  const [adminRole] = deriveRolePda(configPda, opts.admin, Role.Admin);

  let builder = m(program).withdrawWithheld().accounts({
    admin: opts.admin,
    config: configPda,
    adminRole,
    mint: opts.mint,
    feeDestination: opts.feeDestination,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  });

  if (opts.sources?.length) {
    builder = builder.remainingAccounts(opts.sources);
  }

  return builder.instruction();
}
