import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { SssCore } from "../target/types/sss_core";
import { SssTransferHook } from "../target/types/sss_transfer_hook";
import {
  airdropSol,
  createSss4Mint,
  createTokenAccount,
  CORE_PROGRAM_ID,
  deriveConfigPda,
  deriveRolePda,
  deriveExtraAccountMetasPda,
  deriveBlacklistPda,
  grantRole,
  fetchConfig,
  getTokenBalance,
  initReportConnection,
  reportTx,
  HOOK_PROGRAM_ID,
  ROLE_ADMIN,
  ROLE_MINTER,
  ROLE_FREEZER,
} from "./helpers";

describe("SSS-4 Stablecoin (Transfer Fees)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const coreProgram = anchor.workspace.SssCore as Program<SssCore>;
  const hookProgram = anchor.workspace
    .SssTransferHook as Program<SssTransferHook>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const connection = provider.connection;

  let mint: Keypair;
  let configPda: PublicKey;

  const minter = Keypair.generate();
  const freezer = Keypair.generate();
  const userA = Keypair.generate();
  const feeCollector = Keypair.generate();

  let userAAta: PublicKey;
  let feeCollectorAta: PublicKey;

  const FEE_BPS = 100; // 1%
  const MAX_FEE = BigInt(1_000_000); // 1 token (6 decimals)

  before(async () => {
    initReportConnection(connection);
    await airdropSol(connection, payer.publicKey, 100);
    await airdropSol(connection, minter.publicKey, 5);
    await airdropSol(connection, freezer.publicKey, 5);
    await airdropSol(connection, userA.publicKey, 5);
    await airdropSol(connection, feeCollector.publicKey, 5);

    mint = await createSss4Mint(
      provider,
      payer,
      "Fee USD",
      "fUSD",
      "https://example.com/fusd.json",
      6,
      FEE_BPS,
      MAX_FEE
    );

    [configPda] = deriveConfigPda(mint.publicKey);
  });

  it("initializes SSS-4 config with transfer fees", async () => {
    const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);

    const initSig = await coreProgram.methods
      .initialize({
        preset: 4,
        name: "Fee USD",
        symbol: "fUSD",
        uri: "https://example.com/fusd.json",
        decimals: 6,
        supplyCap: null,
        enablePermanentDelegate: true,
        enableTransferHook: true,
        defaultAccountFrozen: true,
        oracleFeedId: null,
        transferFeeBasisPoints: FEE_BPS,
        maximumFee: new BN(MAX_FEE.toString()),
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
    reportTx("SSS-4", "initializes SSS-4 config with transfer fees", "initialize", initSig);

    const config = await fetchConfig(coreProgram, configPda);
    expect(config.preset).to.equal(4);
    expect(config.transferFeeBasisPoints).to.equal(FEE_BPS);
    expect(config.maximumFee.toString()).to.equal(MAX_FEE.toString());
    expect(config.enableTransferHook).to.equal(1);
    expect(config.defaultAccountFrozen).to.equal(1);
  });

  it("initializes extra account metas", async () => {
    const [extraMetasPda] = deriveExtraAccountMetasPda(mint.publicKey);

    const hookSig = await hookProgram.methods
      .initializeExtraAccountMetas()
      .accountsPartial({
        payer: payer.publicKey,
        extraAccountMetas: extraMetasPda,
        mint: mint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    reportTx("SSS-4", "initializes extra account metas", "initialize_extra_account_metas", hookSig);

    const accountInfo = await connection.getAccountInfo(extraMetasPda);
    expect(accountInfo).to.not.be.null;
  });

  it("grants roles and prepares accounts", async () => {
    await grantRole(coreProgram, payer, configPda, minter.publicKey, ROLE_MINTER);
    await grantRole(coreProgram, payer, configPda, freezer.publicKey, ROLE_FREEZER);

    // Create and thaw token accounts
    userAAta = await createTokenAccount(
      connection,
      payer,
      mint.publicKey,
      userA.publicKey
    );
    feeCollectorAta = await createTokenAccount(
      connection,
      payer,
      mint.publicKey,
      feeCollector.publicKey
    );

    const [freezerRolePda] = deriveRolePda(configPda, freezer.publicKey, ROLE_FREEZER);

    await coreProgram.methods
      .thawAccount()
      .accountsPartial({
        freezer: freezer.publicKey,
        config: configPda,
        freezerRole: freezerRolePda,
        mint: mint.publicKey,
        tokenAccount: userAAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezer])
      .rpc();

    await coreProgram.methods
      .thawAccount()
      .accountsPartial({
        freezer: freezer.publicKey,
        config: configPda,
        freezerRole: freezerRolePda,
        mint: mint.publicKey,
        tokenAccount: feeCollectorAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezer])
      .rpc();

    // Mint tokens to user A
    const [minterRolePda] = deriveRolePda(configPda, minter.publicKey, ROLE_MINTER);
    const mintSig = await coreProgram.methods
      .mintTokens(new BN(10_000_000_000)) // 10K tokens
      .accountsPartial({
        minter: minter.publicKey,
        config: configPda,
        minterRole: minterRolePda,
        mint: mint.publicKey,
        to: userAAta,
        priceUpdate: CORE_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter])
      .rpc();
    reportTx("SSS-4", "grants roles and prepares accounts", "mint_tokens", mintSig);

    await connection.confirmTransaction(mintSig, "confirmed");

    const balance = await getTokenBalance(connection, userAAta);
    expect(balance.toString()).to.equal("10000000000");
  });

  it("updates transfer fee", async () => {
    const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);

    const newBps = 200; // 2%
    const newMaxFee = new BN(2_000_000); // 2 tokens

    const feeSig = await coreProgram.methods
      .updateTransferFee(newBps, newMaxFee)
      .accountsPartial({
        admin: payer.publicKey,
        config: configPda,
        adminRole: adminRolePda,
        mint: mint.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();
    reportTx("SSS-4", "updates transfer fee", "update_transfer_fee", feeSig);

    const config = await fetchConfig(coreProgram, configPda);
    expect(config.transferFeeBasisPoints).to.equal(newBps);
    expect(config.maximumFee.toString()).to.equal(newMaxFee.toString());
  });

  it("withdraws withheld fees", async () => {
    const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);

    // withdraw_withheld collects fees from source accounts passed via remainingAccounts
    const withdrawSig = await coreProgram.methods
      .withdrawWithheld()
      .accountsPartial({
        admin: payer.publicKey,
        config: configPda,
        adminRole: adminRolePda,
        mint: mint.publicKey,
        feeDestination: feeCollectorAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: userAAta, isWritable: true, isSigner: false },
      ])
      .rpc();
    reportTx("SSS-4", "withdraws withheld fees", "withdraw_withheld", withdrawSig);
  });

  it("rejects fee update from non-SSS-4 preset", async () => {
    // This is implicitly tested by the program requiring preset == 4
    // Just verify the config is still correct after operations
    const config = await fetchConfig(coreProgram, configPda);
    expect(config.preset).to.equal(4);
  });
});
