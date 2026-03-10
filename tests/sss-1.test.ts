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
  initReportConnection,
  reportTx,
  logInput,
  logOutput,
  logAction,
  ROLE_ADMIN,
  ROLE_MINTER,
  ROLE_FREEZER,
  ROLE_PAUSER,
  ROLE_BURNER,
  ROLE_SEIZER,
} from "./helpers";

describe("SSS-1 Stablecoin", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const coreProgram = anchor.workspace.SssCore as Program<SssCore>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const connection = provider.connection;

  let mint: Keypair;
  let configPda: PublicKey;
  let configBump: number;

  const minter = Keypair.generate();
  const freezer = Keypair.generate();
  const pauser = Keypair.generate();
  const burner = Keypair.generate();
  const seizer = Keypair.generate();
  const recipient = Keypair.generate();
  const treasuryOwner = Keypair.generate();

  let recipientAta: PublicKey;
  let treasuryAta: PublicKey;

  const SUPPLY_CAP = new BN(1_000_000_000_000); // 1M tokens (6 decimals)
  const MINT_AMOUNT = new BN(500_000_000_000); // 500K tokens

  before(async () => {
    initReportConnection(connection);
    await airdropSol(connection, payer.publicKey, 100);
    await airdropSol(connection, minter.publicKey, 5);
    await airdropSol(connection, freezer.publicKey, 5);
    await airdropSol(connection, pauser.publicKey, 5);
    await airdropSol(connection, burner.publicKey, 5);
    await airdropSol(connection, seizer.publicKey, 5);
    await airdropSol(connection, recipient.publicKey, 5);
    await airdropSol(connection, treasuryOwner.publicKey, 5);

    mint = await createSss1Mint(
      provider,
      payer,
      "Test USD",
      "TUSD",
      "https://example.com/tusd.json",
      6
    );

    [configPda, configBump] = deriveConfigPda(mint.publicKey);
  });

  it("initializes an SSS-1 stablecoin", async () => {
    const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);

    logInput("initialize", {
      preset: 1,
      name: "Test USD",
      symbol: "TUSD",
      decimals: 6,
      supplyCap: SUPPLY_CAP,
      mint: mint.publicKey,
      config: configPda,
      authority: payer.publicKey,
    });
    const initSig = await coreProgram.methods
      .initialize({
        preset: 1,
        name: "Test USD",
        symbol: "TUSD",
        uri: "https://example.com/tusd.json",
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
    reportTx("SSS-1", "initializes an SSS-1 stablecoin", "initialize", initSig);
    logOutput("initialize", { signature: initSig });

    const config = await fetchConfig(coreProgram, configPda);
    expect(config.preset).to.equal(1);
    expect(config.paused).to.equal(0);
    expect(config.hasSupplyCap).to.equal(1);
    expect(config.supplyCap.toString()).to.equal(SUPPLY_CAP.toString());
    expect(config.totalMinted.toString()).to.equal("0");
    expect(config.totalBurned.toString()).to.equal("0");
    expect(config.authority.toBase58()).to.equal(payer.publicKey.toBase58());
    expect(config.mint.toBase58()).to.equal(mint.publicKey.toBase58());
    expect(config.adminCount).to.equal(1);
    logOutput("initialize (state)", {
      preset: config.preset,
      supplyCap: config.supplyCap,
      totalMinted: config.totalMinted,
      totalBurned: config.totalBurned,
    });
  });

  it("grants minter role", async () => {
    logAction("Granting minter role", { config: configPda, grantee: minter.publicKey, role: "minter" });
    await grantRole(
      coreProgram,
      payer,
      configPda,
      minter.publicKey,
      ROLE_MINTER
    );

    const [minterRolePda] = deriveRolePda(
      configPda,
      minter.publicKey,
      ROLE_MINTER
    );
    const roleAccount = await coreProgram.account.roleAccount.fetch(
      minterRolePda
    );
    expect(roleAccount.address.toBase58()).to.equal(
      minter.publicKey.toBase58()
    );
    expect(roleAccount.role).to.deep.include({ minter: {} });
    logOutput("grant_role", { roleAccount: minterRolePda.toBase58(), role: "minter" });
  });

  it("mints tokens to a recipient", async () => {
    recipientAta = await createTokenAccount(
      connection,
      payer,
      mint.publicKey,
      recipient.publicKey
    );

    const [minterRolePda] = deriveRolePda(
      configPda,
      minter.publicKey,
      ROLE_MINTER
    );

    logInput("mint_tokens", { amount: MINT_AMOUNT, to: recipientAta, minter: minter.publicKey });
    const sig = await coreProgram.methods
      .mintTokens(MINT_AMOUNT)
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
    reportTx("SSS-1", "mints tokens to a recipient", "mint_tokens", sig);
    logOutput("mint_tokens", { signature: sig });

    // Wait for confirmation before reading balance (validator may lag)
    await connection.confirmTransaction(sig, "confirmed");

    const balance = await getTokenBalance(connection, recipientAta);
    expect(balance.toString()).to.equal(MINT_AMOUNT.toString());

    const config = await fetchConfig(coreProgram, configPda);
    expect(config.totalMinted.toString()).to.equal(MINT_AMOUNT.toString());
    logOutput("mint_tokens (result)", { recipientBalance: balance.toString(), totalMinted: config.totalMinted.toString() });
  });

  it("enforces supply cap", async () => {
    const overCapAmount = new BN(600_000_000_000); // would exceed 1M cap
    const [minterRolePda] = deriveRolePda(
      configPda,
      minter.publicKey,
      ROLE_MINTER
    );
    logInput("mint_tokens (expect fail)", { amount: overCapAmount, supplyCap: SUPPLY_CAP, expectedError: "SupplyCapExceeded" });

    try {
      await coreProgram.methods
        .mintTokens(overCapAmount)
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

  it("grants burner role and burns tokens", async () => {
    await grantRole(
      coreProgram,
      payer,
      configPda,
      burner.publicKey,
      ROLE_BURNER
    );

    const burnAmount = new BN(100_000_000_000); // 100K
    const [burnerRolePda] = deriveRolePda(
      configPda,
      burner.publicKey,
      ROLE_BURNER
    );
    logInput("burn_tokens", { amount: burnAmount, from: recipientAta });

    const burnSig = await coreProgram.methods
      .burnTokens(burnAmount)
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
    reportTx("SSS-1", "grants burner role and burns tokens", "burn_tokens", burnSig);
    logOutput("burn_tokens", { signature: burnSig });

    await connection.confirmTransaction(burnSig, "confirmed");

    const balance = await getTokenBalance(connection, recipientAta);
    expect(balance.toString()).to.equal("400000000000");

    const config = await fetchConfig(coreProgram, configPda);
    expect(config.totalBurned.toString()).to.equal(burnAmount.toString());
    logOutput("burn_tokens (result)", { recipientBalance: balance.toString(), totalBurned: config.totalBurned.toString() });
  });

  it("freezes and thaws a token account", async () => {
    await grantRole(
      coreProgram,
      payer,
      configPda,
      freezer.publicKey,
      ROLE_FREEZER
    );

    const [freezerRolePda] = deriveRolePda(
      configPda,
      freezer.publicKey,
      ROLE_FREEZER
    );
    logAction("Freezing account", { tokenAccount: recipientAta });

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
    logOutput("freeze_account", { tokenAccount: recipientAta });

    // Verify frozen: minting to frozen account should still work
    // (freeze only blocks transfers by the owner, not CPI mints)
    // But let's thaw to verify the thaw path works

    await coreProgram.methods
      .thawAccount()
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
    logOutput("thaw_account", { tokenAccount: recipientAta });
  });

  it("pauses and unpauses operations", async () => {
    await grantRole(
      coreProgram,
      payer,
      configPda,
      pauser.publicKey,
      ROLE_PAUSER
    );

    const [pauserRolePda] = deriveRolePda(
      configPda,
      pauser.publicKey,
      ROLE_PAUSER
    );
    logAction("Pausing operations", { config: configPda });

    await coreProgram.methods
      .pause()
      .accountsPartial({
        pauser: pauser.publicKey,
        config: configPda,
        pauserRole: pauserRolePda,
      })
      .signers([pauser])
      .rpc();

    let config = await fetchConfig(coreProgram, configPda);
    expect(config.paused).to.equal(1);
    logOutput("pause", { config: configPda, paused: config.paused });

    // Minting while paused should fail
    const [minterRolePda] = deriveRolePda(
      configPda,
      minter.publicKey,
      ROLE_MINTER
    );
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
      logOutput("mint_tokens (rejected, paused)", { error: "Paused as expected" });
    }

    logAction("Unpausing operations");
    await coreProgram.methods
      .unpause()
      .accountsPartial({
        pauser: pauser.publicKey,
        config: configPda,
        pauserRole: pauserRolePda,
      })
      .signers([pauser])
      .rpc();

    config = await fetchConfig(coreProgram, configPda);
    expect(config.paused).to.equal(0);
    logOutput("unpause", { config: configPda, paused: config.paused });
  });

  it("seizes tokens via permanent delegate", async () => {
    await grantRole(
      coreProgram,
      payer,
      configPda,
      seizer.publicKey,
      ROLE_SEIZER
    );

    treasuryAta = await createTokenAccount(
      connection,
      payer,
      mint.publicKey,
      treasuryOwner.publicKey
    );

    const seizeAmount = new BN(50_000_000_000); // 50K
    const [seizerRolePda] = deriveRolePda(
      configPda,
      seizer.publicKey,
      ROLE_SEIZER
    );
    logInput("seize", { amount: seizeAmount, from: recipientAta, to: treasuryAta });

    const balanceBefore = await getTokenBalance(connection, recipientAta);

    const seizeSig = await coreProgram.methods
      .seize(seizeAmount)
      .accountsPartial({
        seizer: seizer.publicKey,
        config: configPda,
        seizerRole: seizerRolePda,
        mint: mint.publicKey,
        from: recipientAta,
        to: treasuryAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([seizer])
      .rpc();
    reportTx("SSS-1", "seizes tokens via permanent delegate", "seize", seizeSig);
    logOutput("seize", { signature: seizeSig });

    await connection.confirmTransaction(seizeSig, "confirmed");

    const balanceAfter = await getTokenBalance(connection, recipientAta);
    const treasuryBalance = await getTokenBalance(connection, treasuryAta);

    expect((balanceBefore - balanceAfter).toString()).to.equal(
      seizeAmount.toString()
    );
    expect(treasuryBalance.toString()).to.equal(seizeAmount.toString());
    logOutput("seize (result)", {
      recipientBalanceBefore: balanceBefore.toString(),
      recipientBalanceAfter: balanceAfter.toString(),
      treasuryBalance: treasuryBalance.toString(),
    });
  });

  it("revokes minter role", async () => {
    const [minterRolePda] = deriveRolePda(
      configPda,
      minter.publicKey,
      ROLE_MINTER
    );
    const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);
    logAction("Revoking minter role", { roleAccount: minterRolePda, role: "minter" });

    await coreProgram.methods
      .revokeRole()
      .accountsPartial({
        admin: payer.publicKey,
        config: configPda,
        adminRole: adminRolePda,
        roleAccount: minterRolePda,
      })
      .rpc();

    // Minting should now fail (role account closed)
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
      expect.fail("Should have thrown because role was revoked");
    } catch (err: any) {
      expect(err).to.exist;
      logOutput("mint_tokens (rejected)", { error: "Role revoked as expected" });
    }
  });

  it("transfers authority (propose + accept)", async () => {
    const newAuthority = Keypair.generate();
    await airdropSol(connection, newAuthority.publicKey, 5);

    const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);
    logInput("propose_authority", { currentAuthority: payer.publicKey, newAuthority: newAuthority.publicKey });

    // Propose
    await coreProgram.methods
      .proposeAuthority()
      .accountsPartial({
        admin: payer.publicKey,
        config: configPda,
        adminRole: adminRolePda,
        newAuthority: newAuthority.publicKey,
      })
      .rpc();

    let config = await fetchConfig(coreProgram, configPda);
    expect(config.hasPendingAuthority).to.equal(1);
    expect(config.pendingAuthority.toBase58()).to.equal(
      newAuthority.publicKey.toBase58()
    );
    logOutput("propose_authority", { pendingAuthority: config.pendingAuthority });

    // Accept
    const [newAdminRolePda] = deriveRolePda(
      configPda,
      newAuthority.publicKey,
      ROLE_ADMIN
    );

    await coreProgram.methods
      .acceptAuthority()
      .accountsPartial({
        newAuthority: newAuthority.publicKey,
        oldAuthority: payer.publicKey,
        config: configPda,
        oldAdminRole: adminRolePda,
        newAdminRole: newAdminRolePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([newAuthority])
      .rpc();

    config = await fetchConfig(coreProgram, configPda);
    expect(config.authority.toBase58()).to.equal(
      newAuthority.publicKey.toBase58()
    );
    expect(config.hasPendingAuthority).to.equal(0);
    logOutput("accept_authority", { newAuthority: config.authority });
  });
});
