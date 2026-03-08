import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { SssCore } from "../target/types/sss_core";
import {
  airdropSol,
  createSss3Mint,
  createTokenAccount,
  CORE_PROGRAM_ID,
  deriveConfigPda,
  deriveRolePda,
  grantRole,
  fetchConfig,
  getTokenBalance,
  initReportConnection,
  reportTx,
  ROLE_ADMIN,
  ROLE_MINTER,
} from "./helpers";

/**
 * SSS-3 integration test: mint creation + config init + standard mint.
 * Confidential transfer operations (deposit, withdraw, transfer with ZK) are not tested.
 */
describe("SSS-3 Stablecoin", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const coreProgram = anchor.workspace.SssCore as Program<SssCore>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const connection = provider.connection;

  let mint: Keypair;
  let configPda: PublicKey;

  const minter = Keypair.generate();
  const recipient = Keypair.generate();
  let recipientAta: PublicKey;

  const SUPPLY_CAP = new BN(1_000_000_000_000); // 1M tokens (6 decimals)
  const MINT_AMOUNT = new BN(100_000_000_000); // 100K tokens

  before(async () => {
    initReportConnection(connection);
    await airdropSol(connection, payer.publicKey, 100);
    await airdropSol(connection, minter.publicKey, 5);
    await airdropSol(connection, recipient.publicKey, 5);

    mint = await createSss3Mint(
      provider,
      payer,
      "Confidential USD",
      "cUSD",
      "https://example.com/cusd.json",
      6
    );

    [configPda] = deriveConfigPda(mint.publicKey);
  });

  it("initializes an SSS-3 stablecoin", async () => {
    const [adminRolePda] = deriveRolePda(configPda, payer.publicKey, ROLE_ADMIN);

    const initSig = await coreProgram.methods
      .initialize({
        preset: 3,
        name: "Confidential USD",
        symbol: "cUSD",
        uri: "https://example.com/cusd.json",
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
    reportTx("SSS-3", "initializes an SSS-3 stablecoin", "initialize", initSig);

    const config = await fetchConfig(coreProgram, configPda);
    expect(config.preset).to.equal(3);
    expect(config.paused).to.equal(0);
    expect(config.hasSupplyCap).to.equal(1);
    expect(config.supplyCap.toString()).to.equal(SUPPLY_CAP.toString());
    expect(config.totalMinted.toString()).to.equal("0");
    expect(config.totalBurned.toString()).to.equal("0");
    expect(config.authority.toBase58()).to.equal(payer.publicKey.toBase58());
    expect(config.mint.toBase58()).to.equal(mint.publicKey.toBase58());
    expect(config.adminCount).to.equal(1);
  });

  it("grants minter role and mints tokens", async () => {
    await grantRole(
      coreProgram,
      payer,
      configPda,
      minter.publicKey,
      ROLE_MINTER
    );

    recipientAta = await createTokenAccount(
      connection,
      payer,
      mint.publicKey,
      recipient.publicKey
    );

    const [minterRolePda] = deriveRolePda(configPda, minter.publicKey, ROLE_MINTER);

    const mintSig = await coreProgram.methods
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
    reportTx("SSS-3", "grants minter role and mints tokens", "mint_tokens", mintSig);

    await connection.confirmTransaction(mintSig, "confirmed");

    const balance = await getTokenBalance(connection, recipientAta);
    expect(balance.toString()).to.equal(MINT_AMOUNT.toString());

    const config = await fetchConfig(coreProgram, configPda);
    expect(config.totalMinted.toString()).to.equal(MINT_AMOUNT.toString());
  });
});
