/**
 * Oracle integration tests.
 * Tests that mint_tokens requires PriceUpdateV2 when config.has_oracle_feed is set.
 * Local validator has no Pyth feeds, so we test the error path only.
 * FUTURE: Full oracle mint test requires devnet Pyth feed or mock.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { expect } from "chai";
import { SssCore } from "../target/types/sss_core";
import {
  airdropSol,
  createSss1Mint,
  createTokenAccount,
  CORE_PROGRAM_ID,
  deriveConfigPda,
  deriveRolePda,
  grantRole,
  logInput,
  logOutput,
  ROLE_ADMIN,
  ROLE_MINTER,
} from "./helpers";

// SOL/USD Pyth feed ID (32 bytes) - from pyth.network
const SOL_USD_FEED_ID = Buffer.from(
  "7f2cc9242905d11b6b9d97105d5628e9da9b63ae655070baf9baf53d7bd0d96d",
  "hex"
);

describe("Oracle (Pyth)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const coreProgram = anchor.workspace.SssCore as Program<SssCore>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const connection = provider.connection;

  let mint: Keypair;
  let configPda: PublicKey;
  const minter = Keypair.generate();
  const recipient = Keypair.generate();

  before(async () => {
    await airdropSol(connection, payer.publicKey, 100);
    await airdropSol(connection, minter.publicKey, 5);
    await airdropSol(connection, recipient.publicKey, 5);

    mint = await createSss1Mint(
      provider,
      payer,
      "Oracle USD",
      "OUSD",
      "https://example.com/ousd.json",
      6
    );

    [configPda] = deriveConfigPda(mint.publicKey);
  });

  it("initializes config with oracle_feed_id", async () => {
    const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);
    logInput("initialize", { preset: 1, oracleFeedId: "SOL/USD" });

    await coreProgram.methods
      .initialize({
        preset: 1,
        name: "Oracle USD",
        symbol: "OUSD",
        uri: "https://example.com/ousd.json",
        decimals: 6,
        supplyCap: new BN(1_000_000_000_000),
        enablePermanentDelegate: true,
        enableTransferHook: null,
        defaultAccountFrozen: null,
        oracleFeedId: Array.from(SOL_USD_FEED_ID),
        transferFeeBasisPoints: null,
        maximumFee: null,
      })
      .accountsPartial({
        authority: payer.publicKey,
        config: configPda,
        mint: mint.publicKey,
        adminRole: adminRolePda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await coreProgram.account.stablecoinConfig.fetch(configPda);
    expect(config.hasOracleFeed).to.equal(1);
    expect(Buffer.from(config.oracleFeedId).toString("hex")).to.equal(
      SOL_USD_FEED_ID.toString("hex")
    );
    logOutput("initialize", { hasOracleFeed: config.hasOracleFeed });
  });

  it("rejects mint without price update when oracle is configured", async () => {
    await grantRole(
      coreProgram,
      payer,
      configPda,
      minter.publicKey,
      ROLE_MINTER
    );

    const ata = getAssociatedTokenAddressSync(
      mint.publicKey,
      recipient.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const [minterRolePda] = deriveRolePda(configPda, minter.publicKey, ROLE_MINTER);

    const createAtaIx = createAssociatedTokenAccountInstruction(
      minter.publicKey,
      ata,
      recipient.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new anchor.web3.Transaction().add(createAtaIx);

    const ataInfo = await connection.getAccountInfo(ata);
    if (!ataInfo) {
      await provider.sendAndConfirm(tx, [minter]);
    }

    logInput("mint_tokens (expect fail)", { expectedError: "PriceUpdateRequired", oracleConfigured: true });
    try {
      await coreProgram.methods
        .mintTokens(new BN(1_000_000))
        .accountsPartial({
          minter: minter.publicKey,
          config: configPda,
          minterRole: minterRolePda,
          mint: mint.publicKey,
          to: ata,
          priceUpdate: CORE_PROGRAM_ID, // placeholder = None; program requires real PriceUpdateV2 when oracle configured
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();

      expect.fail("Expected mint to fail with PriceUpdateRequired");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(
        msg.includes("PriceUpdateRequired") || msg.includes("Price update account required"),
        `Expected oracle error, got: ${msg}`
      ).to.be.true;
      logOutput("mint_tokens (rejected)", { error: "PriceUpdateRequired as expected" });
    }
  });
});
