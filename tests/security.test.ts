import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
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
  fetchConfig,
  getTokenBalance,
  logInput,
  logOutput,
  logAction,
  ROLE_ADMIN,
  ROLE_MINTER,
  ROLE_FREEZER,
  ROLE_PAUSER,
  ROLE_BURNER,
} from "./helpers";

describe("Security Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const coreProgram = anchor.workspace.SssCore as Program<SssCore>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const connection = provider.connection;

  let mint: Keypair;
  let configPda: PublicKey;

  const minter = Keypair.generate();
  const freezer = Keypair.generate();
  const pauser = Keypair.generate();
  const burner = Keypair.generate();
  const attacker = Keypair.generate();
  const recipient = Keypair.generate();

  let recipientAta: PublicKey;

  const SUPPLY_CAP = new BN(1_000_000_000_000); // 1M tokens

  before(async () => {
    await airdropSol(connection, payer.publicKey, 100);
    await airdropSol(connection, minter.publicKey, 5);
    await airdropSol(connection, freezer.publicKey, 5);
    await airdropSol(connection, pauser.publicKey, 5);
    await airdropSol(connection, burner.publicKey, 5);
    await airdropSol(connection, attacker.publicKey, 5);
    await airdropSol(connection, recipient.publicKey, 5);

    mint = await createSss1Mint(
      provider,
      payer,
      "Secure USD",
      "sUSD",
      "https://example.com/susd.json",
      6
    );

    [configPda] = deriveConfigPda(mint.publicKey);

    const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);

    await coreProgram.methods
      .initialize({
        preset: 1,
        name: "Secure USD",
        symbol: "sUSD",
        uri: "https://example.com/susd.json",
        decimals: 6,
        supplyCap: SUPPLY_CAP,
        enablePermanentDelegate: true,
        enableTransferHook: null,
        defaultAccountFrozen: null,
        oracleFeedId: null,
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

    // Grant required roles
    await grantRole(coreProgram, payer, configPda, minter.publicKey, ROLE_MINTER);
    await grantRole(coreProgram, payer, configPda, freezer.publicKey, ROLE_FREEZER);
    await grantRole(coreProgram, payer, configPda, pauser.publicKey, ROLE_PAUSER);
    await grantRole(coreProgram, payer, configPda, burner.publicKey, ROLE_BURNER);

    recipientAta = await createTokenAccount(
      connection,
      payer,
      mint.publicKey,
      recipient.publicKey
    );

    // Mint initial tokens
    const [minterRolePda] = deriveRolePda(configPda, minter.publicKey, ROLE_MINTER);
    await coreProgram.methods
      .mintTokens(new BN(500_000_000_000))
      .accountsPartial({
        minter: minter.publicKey,
        config: configPda,
        minterRole: minterRolePda,
        mint: mint.publicKey,
        to: recipientAta,
        priceUpdate: CORE_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter])
      .rpc();
  });

  describe("Unauthorized operations", () => {
    it("unauthorized minting fails", async () => {
      const [attackerMinterPda] = deriveRolePda(
        configPda,
        attacker.publicKey,
        ROLE_MINTER
      );
      logInput("mint_tokens (expect fail)", { minter: attacker.publicKey, expectedError: "no minter role" });

      try {
        await coreProgram.methods
          .mintTokens(new BN(1_000_000))
          .accountsPartial({
            minter: attacker.publicKey,
            config: configPda,
            minterRole: attackerMinterPda,
            mint: mint.publicKey,
            to: recipientAta,
            priceUpdate: CORE_PROGRAM_ID,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown - attacker has no minter role");
      } catch (err: any) {
        // PDA does not exist, so account constraint fails
        expect(err).to.exist;
        logOutput("mint_tokens (rejected)", { error: "unauthorized as expected" });
      }
    });

    it("unauthorized freezing fails", async () => {
      const [attackerFreezerPda] = deriveRolePda(
        configPda,
        attacker.publicKey,
        ROLE_FREEZER
      );
      logInput("freeze_account (expect fail)", { freezer: attacker.publicKey });

      try {
        await coreProgram.methods
          .freezeAccount()
          .accountsPartial({
            freezer: attacker.publicKey,
            config: configPda,
            freezerRole: attackerFreezerPda,
            mint: mint.publicKey,
            tokenAccount: recipientAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown - attacker has no freezer role");
      } catch (err: any) {
        expect(err).to.exist;
        logOutput("freeze_account (rejected)", { error: "unauthorized as expected" });
      }
    });

    it("unauthorized pausing fails", async () => {
      const [attackerPauserPda] = deriveRolePda(
        configPda,
        attacker.publicKey,
        ROLE_PAUSER
      );
      logInput("pause (expect fail)", { pauser: attacker.publicKey });

      try {
        await coreProgram.methods
          .pause()
          .accountsPartial({
            pauser: attacker.publicKey,
            config: configPda,
            pauserRole: attackerPauserPda,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown - attacker has no pauser role");
      } catch (err: any) {
        expect(err).to.exist;
        logOutput("pause (rejected)", { error: "unauthorized as expected" });
      }
    });

    it("unauthorized burning fails", async () => {
      const [attackerBurnerPda] = deriveRolePda(
        configPda,
        attacker.publicKey,
        ROLE_BURNER
      );
      logInput("burn_tokens (expect fail)", { burner: attacker.publicKey });

      try {
        await coreProgram.methods
          .burnTokens(new BN(1_000_000))
          .accountsPartial({
            burner: attacker.publicKey,
            config: configPda,
            burnerRole: attackerBurnerPda,
            mint: mint.publicKey,
            from: recipientAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown - attacker has no burner role");
      } catch (err: any) {
        expect(err).to.exist;
        logOutput("burn_tokens (rejected)", { error: "unauthorized as expected" });
      }
    });
  });

  describe("Paused state restrictions", () => {
    before(async () => {
      const [pauserRolePda] = deriveRolePda(
        configPda,
        pauser.publicKey,
        ROLE_PAUSER
      );

      await coreProgram.methods
        .pause()
        .accountsPartial({
          pauser: pauser.publicKey,
          config: configPda,
          pauserRole: pauserRolePda,
        })
        .signers([pauser])
        .rpc();
    });

    after(async () => {
      const [pauserRolePda] = deriveRolePda(
        configPda,
        pauser.publicKey,
        ROLE_PAUSER
      );

      await coreProgram.methods
        .unpause()
        .accountsPartial({
          pauser: pauser.publicKey,
          config: configPda,
          pauserRole: pauserRolePda,
        })
        .signers([pauser])
        .rpc();
    });

    it("minting fails when paused", async () => {
      const [minterRolePda] = deriveRolePda(
        configPda,
        minter.publicKey,
        ROLE_MINTER
      );
      logInput("mint_tokens (expect fail, paused)", { amount: "1M" });

      try {
        await coreProgram.methods
          .mintTokens(new BN(1_000_000))
          .accountsPartial({
            minter: minter.publicKey,
            config: configPda,
            minterRole: minterRolePda,
            mint: mint.publicKey,
            to: recipientAta,
            priceUpdate: CORE_PROGRAM_ID,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have thrown Paused");
      } catch (err: any) {
        expect(err.toString()).to.include("Paused");
        logOutput("mint_tokens (rejected)", { error: "Paused as expected" });
      }
    });

    it("burning fails when paused", async () => {
      const [burnerRolePda] = deriveRolePda(
        configPda,
        burner.publicKey,
        ROLE_BURNER
      );
      logInput("burn_tokens (expect fail, paused)", { amount: "1M" });

      try {
        await coreProgram.methods
          .burnTokens(new BN(1_000_000))
          .accountsPartial({
            burner: burner.publicKey,
            config: configPda,
            burnerRole: burnerRolePda,
            mint: mint.publicKey,
            from: recipientAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([burner])
          .rpc();
        expect.fail("Should have thrown Paused");
      } catch (err: any) {
        expect(err.toString()).to.include("Paused");
        logOutput("burn_tokens (rejected)", { error: "Paused as expected" });
      }
    });

    it("freezing fails when paused", async () => {
      const [freezerRolePda] = deriveRolePda(
        configPda,
        freezer.publicKey,
        ROLE_FREEZER
      );
      logInput("freeze_account (expect fail, paused)", { tokenAccount: recipientAta });

      try {
        await coreProgram.methods
          .freezeAccount()
          .accountsPartial({
            freezer: freezer.publicKey,
            config: configPda,
            freezerRole: freezerRolePda,
            mint: mint.publicKey,
            tokenAccount: recipientAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([freezer])
          .rpc();
        expect.fail("Should have thrown Paused");
      } catch (err: any) {
        expect(err.toString()).to.include("Paused");
        logOutput("freeze_account (rejected)", { error: "Paused as expected" });
      }
    });

    it("pausing again fails (already paused)", async () => {
      const [pauserRolePda] = deriveRolePda(
        configPda,
        pauser.publicKey,
        ROLE_PAUSER
      );
      logInput("pause (expect fail)", { reason: "already paused" });

      try {
        await coreProgram.methods
          .pause()
          .accountsPartial({
            pauser: pauser.publicKey,
            config: configPda,
            pauserRole: pauserRolePda,
          })
          .signers([pauser])
          .rpc();
        expect.fail("Should have thrown - already paused");
      } catch (err: any) {
        expect(err.toString()).to.include("Paused");
        logOutput("pause (rejected)", { error: "already paused as expected" });
      }
    });
  });

  describe("Supply and amount constraints", () => {
    it("supply cap overflow fails", async () => {
      logInput("mint_tokens (expect fail)", { amount: "600K", supplyCap: "1M", currentMinted: "500K" });
      // Already minted 500K. Cap is 1M. Try to mint 600K.
      const [minterRolePda] = deriveRolePda(
        configPda,
        minter.publicKey,
        ROLE_MINTER
      );

      try {
        await coreProgram.methods
          .mintTokens(new BN(600_000_000_000)) // 600K (500K + 600K > 1M cap)
          .accountsPartial({
            minter: minter.publicKey,
            config: configPda,
            minterRole: minterRolePda,
            mint: mint.publicKey,
            to: recipientAta,
            priceUpdate: CORE_PROGRAM_ID,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have thrown SupplyCapExceeded");
      } catch (err: any) {
        expect(err.toString()).to.include("SupplyCapExceeded");
        logOutput("mint_tokens (rejected)", { error: "SupplyCapExceeded as expected" });
      }
    });

    it("zero amount mint fails", async () => {
      const [minterRolePda] = deriveRolePda(
        configPda,
        minter.publicKey,
        ROLE_MINTER
      );
      logInput("mint_tokens (expect fail)", { amount: 0, expectedError: "ZeroAmount" });

      try {
        await coreProgram.methods
          .mintTokens(new BN(0))
          .accountsPartial({
            minter: minter.publicKey,
            config: configPda,
            minterRole: minterRolePda,
            mint: mint.publicKey,
            to: recipientAta,
            priceUpdate: CORE_PROGRAM_ID,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have thrown ZeroAmount");
      } catch (err: any) {
        expect(err.toString()).to.include("ZeroAmount");
        logOutput("mint_tokens (rejected)", { error: "ZeroAmount as expected" });
      }
    });

    it("zero amount burn fails", async () => {
      const [burnerRolePda] = deriveRolePda(
        configPda,
        burner.publicKey,
        ROLE_BURNER
      );
      logInput("burn_tokens (expect fail)", { amount: 0, expectedError: "ZeroAmount" });

      try {
        await coreProgram.methods
          .burnTokens(new BN(0))
          .accountsPartial({
            burner: burner.publicKey,
            config: configPda,
            burnerRole: burnerRolePda,
            mint: mint.publicKey,
            from: recipientAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([burner])
          .rpc();
        expect.fail("Should have thrown ZeroAmount");
      } catch (err: any) {
        expect(err.toString()).to.include("ZeroAmount");
        logOutput("burn_tokens (rejected)", { error: "ZeroAmount as expected" });
      }
    });

    it("unpausing when not paused fails", async () => {
      const [pauserRolePda] = deriveRolePda(
        configPda,
        pauser.publicKey,
        ROLE_PAUSER
      );
      logInput("unpause (expect fail)", { expectedError: "NotPaused", reason: "not paused" });

      try {
        await coreProgram.methods
          .unpause()
          .accountsPartial({
            pauser: pauser.publicKey,
            config: configPda,
            pauserRole: pauserRolePda,
          })
          .signers([pauser])
          .rpc();
        expect.fail("Should have thrown NotPaused");
      } catch (err: any) {
        expect(err.toString()).to.include("NotPaused");
        logOutput("unpause (rejected)", { error: "NotPaused as expected" });
      }
    });
  });

  describe("Authority transfer edge cases", () => {
    it("accept_authority without proposal fails", async () => {
      const newAuth = Keypair.generate();
      await airdropSol(connection, newAuth.publicKey, 2);

      const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);
      const [newAdminRolePda] = deriveRolePda(
        configPda,
        newAuth.publicKey,
        ROLE_ADMIN
      );

      try {
        await coreProgram.methods
          .acceptAuthority()
          .accountsPartial({
            newAuthority: newAuth.publicKey,
            oldAuthority: payer.publicKey,
            config: configPda,
            oldAdminRole: adminRolePda,
            newAdminRole: newAdminRolePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([newAuth])
          .rpc();
        expect.fail("Should have thrown NoPendingAuthority");
      } catch (err: any) {
        expect(err.toString()).to.include("NoPendingAuthority");
      }
    });

    it("wrong signer cannot accept authority", async () => {
      const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);
      const intended = Keypair.generate();
      await airdropSol(connection, intended.publicKey, 2);

      // Propose to intended
      await coreProgram.methods
        .proposeAuthority()
        .accountsPartial({
          admin: payer.publicKey,
          config: configPda,
          adminRole: adminRolePda,
          newAuthority: intended.publicKey,
        })
        .rpc();

      // Attacker tries to accept
      const [attackerAdminRole] = deriveRolePda(
        configPda,
        attacker.publicKey,
        ROLE_ADMIN
      );
      try {
        await coreProgram.methods
          .acceptAuthority()
          .accountsPartial({
            newAuthority: attacker.publicKey,
            oldAuthority: payer.publicKey,
            config: configPda,
            oldAdminRole: adminRolePda,
            newAdminRole: attackerAdminRole,
            systemProgram: SystemProgram.programId,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown UnauthorizedAcceptor");
      } catch (err: any) {
        expect(err).to.exist;
      }

      // Clean up: cancel the proposal by letting intended accept
      const [intendedAdminRole] = deriveRolePda(
        configPda,
        intended.publicKey,
        ROLE_ADMIN
      );
      await coreProgram.methods
        .acceptAuthority()
        .accountsPartial({
          newAuthority: intended.publicKey,
          oldAuthority: payer.publicKey,
          config: configPda,
          oldAdminRole: adminRolePda,
          newAdminRole: intendedAdminRole,
          systemProgram: SystemProgram.programId,
        })
        .signers([intended])
        .rpc();
    });
  });
});
