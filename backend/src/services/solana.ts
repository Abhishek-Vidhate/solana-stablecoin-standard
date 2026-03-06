import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@abhishek-vidhate/sss-token";
import fs from "fs";
import { logger } from "./logger";

export class SolanaService {
  private static instance: SolanaService;
  private connection: Connection;
  private wallet: Wallet;

  private constructor(rpcUrl: string, keypairPath: string) {
    this.connection = new Connection(rpcUrl, "confirmed");

    const resolved = keypairPath.replace("~", process.env.HOME ?? "");
    const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(raw));
    this.wallet = new Wallet(keypair);

    logger.info("Solana service initialized", {
      rpc: rpcUrl,
      wallet: this.wallet.publicKey.toBase58(),
    });
  }

  static init(rpcUrl: string, keypairPath: string): SolanaService {
    if (!SolanaService.instance) {
      SolanaService.instance = new SolanaService(rpcUrl, keypairPath);
    }
    return SolanaService.instance;
  }

  static get(): SolanaService {
    if (!SolanaService.instance) {
      throw new Error("SolanaService not initialized — call init() first");
    }
    return SolanaService.instance;
  }

  getConnection(): Connection {
    return this.connection;
  }

  getWallet(): Wallet {
    return this.wallet;
  }

  loadStablecoin(mint: string): SolanaStablecoin {
    return SolanaStablecoin.load(
      this.connection,
      this.wallet,
      new PublicKey(mint)
    );
  }
}
