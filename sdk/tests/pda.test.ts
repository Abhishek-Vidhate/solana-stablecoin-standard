import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  deriveConfigPda,
  deriveRolePda,
  deriveBlacklistPda,
  deriveExtraAccountMetasPda,
} from "../src/pda";
import {
  SSS_CORE_PROGRAM_ID,
  SSS_TRANSFER_HOOK_PROGRAM_ID,
  Role,
} from "../src/types";

describe("PDA derivation", () => {
  it("derives config PDA deterministically", () => {
    const mint = PublicKey.unique();
    const [pda1, bump1] = deriveConfigPda(mint);
    const [pda2, bump2] = deriveConfigPda(mint);
    expect(pda1.equals(pda2)).toBe(true);
    expect(bump1).toBe(bump2);
  });

  it("derives different PDAs for different mints", () => {
    const mint1 = PublicKey.unique();
    const mint2 = PublicKey.unique();
    const [pda1] = deriveConfigPda(mint1);
    const [pda2] = deriveConfigPda(mint2);
    expect(pda1.equals(pda2)).toBe(false);
  });

  it("config PDA is off-curve", () => {
    const mint = PublicKey.unique();
    const [pda] = deriveConfigPda(mint);
    expect(PublicKey.isOnCurve(pda.toBuffer())).toBe(false);
  });

  it("derives role PDA deterministically", () => {
    const config = PublicKey.unique();
    const address = PublicKey.unique();
    const [pda1] = deriveRolePda(config, address, Role.Minter);
    const [pda2] = deriveRolePda(config, address, Role.Minter);
    expect(pda1.equals(pda2)).toBe(true);
  });

  it("derives different role PDAs for different roles", () => {
    const config = PublicKey.unique();
    const address = PublicKey.unique();
    const [minterPda] = deriveRolePda(config, address, Role.Minter);
    const [freezerPda] = deriveRolePda(config, address, Role.Freezer);
    expect(minterPda.equals(freezerPda)).toBe(false);
  });

  it("derives blacklist PDA deterministically", () => {
    const mint = PublicKey.unique();
    const address = PublicKey.unique();
    const [pda1] = deriveBlacklistPda(mint, address);
    const [pda2] = deriveBlacklistPda(mint, address);
    expect(pda1.equals(pda2)).toBe(true);
  });

  it("derives extra account metas PDA deterministically", () => {
    const mint = PublicKey.unique();
    const [pda1] = deriveExtraAccountMetasPda(mint);
    const [pda2] = deriveExtraAccountMetasPda(mint);
    expect(pda1.equals(pda2)).toBe(true);
  });

  it("uses correct default program IDs", () => {
    const mint = PublicKey.unique();
    const [pdaDefault] = deriveConfigPda(mint);
    const [pdaExplicit] = deriveConfigPda(mint, SSS_CORE_PROGRAM_ID);
    expect(pdaDefault.equals(pdaExplicit)).toBe(true);

    const address = PublicKey.unique();
    const [blDefault] = deriveBlacklistPda(mint, address);
    const [blExplicit] = deriveBlacklistPda(mint, address, SSS_TRANSFER_HOOK_PROGRAM_ID);
    expect(blDefault.equals(blExplicit)).toBe(true);
  });
});
