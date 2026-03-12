/**
 * Verify SDK public exports.
 */

import { describe, it, expect } from "vitest";
import * as sdk from "../src/index";

describe("SDK exports", () => {
  it("exports confidential module", () => {
    expect(sdk.createDepositInstruction).toBeDefined();
    expect(sdk.createApplyPendingBalanceInstruction).toBeDefined();
    expect(sdk.ConfidentialOps).toBeDefined();
    expect(sdk.generateTestElGamalKeypair).toBeDefined();
    expect(sdk.generateTestAesKey).toBeDefined();
    expect(sdk.deriveElGamalKeypair).toBeDefined();
    expect(sdk.parseConfidentialTransferAccountState).toBeDefined();
    expect(sdk.CONFIDENTIAL_TRANSFER_ACCOUNT_EXTENSION_LENGTH).toBe(295);
  });

  it("exports SSS client", () => {
    expect(sdk.SSS).toBeDefined();
  });

  it("exports PDA functions", () => {
    expect(sdk.deriveConfigPda).toBeDefined();
    expect(sdk.deriveRolePda).toBeDefined();
    expect(sdk.deriveBlacklistPda).toBeDefined();
    expect(sdk.deriveExtraAccountMetasPda).toBeDefined();
  });
});
