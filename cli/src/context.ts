import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { SolanaStablecoin } from "@abhishek-vidhate/sss-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface CliContext {
  connection: Connection;
  wallet: Wallet;
  keypair: Keypair;
}

export function createContext(opts: {
  rpcUrl?: string;
  keypairPath?: string;
}): CliContext {
  const rpcUrl =
    opts.rpcUrl ||
    process.env.SOLANA_RPC_URL ||
    "http://localhost:8899";

  const keypairPath =
    opts.keypairPath ||
    process.env.SOLANA_KEYPAIR ||
    path.join(os.homedir(), ".config", "solana", "id.json");

  const connection = new Connection(rpcUrl, "confirmed");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const wallet = new Wallet(keypair);

  return { connection, wallet, keypair };
}

export function loadStablecoin(
  ctx: CliContext,
  mint: string
): SolanaStablecoin {
  const { PublicKey } = require("@solana/web3.js");
  return SolanaStablecoin.load(ctx.connection, ctx.wallet, new PublicKey(mint));
}

export function resolveMint(opts: { mint?: string }): string {
  const mint =
    opts.mint || process.env.SSS_MINT || process.env.SSS_CONFIG;

  if (!mint) {
    console.error("Error: --mint is required (or set SSS_MINT env var)");
    process.exit(1);
  }
  return mint;
}
