import { Command } from "commander";
import { Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { SolanaStablecoin, Preset } from "@abhishek-vidhate/sss-token";
import { createContext } from "../context";
import chalk from "chalk";

export function registerInit(program: Command) {
  program
    .command("init")
    .description("Initialize a new stablecoin")
    .requiredOption("--preset <number>", "Preset (1=SSS-1, 2=SSS-2, 3=SSS-3, 4=SSS-4)", parseInt)
    .requiredOption("--name <string>", "Token name")
    .requiredOption("--symbol <string>", "Token symbol")
    .option("--uri <string>", "Metadata URI", "")
    .option("--decimals <number>", "Decimals", parseInt, 6)
    .option("--supply-cap <number>", "Supply cap (in base units)")
    .option("--fee-bps <number>", "Transfer fee basis points (SSS-4)", parseInt)
    .option("--max-fee <number>", "Maximum fee per transfer (SSS-4)")
    .action(async (opts) => {
      const ctx = createContext(program.opts());

      console.log(chalk.blue(`Initializing SSS-${opts.preset} stablecoin...`));
      console.log(`  Name:     ${opts.name}`);
      console.log(`  Symbol:   ${opts.symbol}`);
      console.log(`  Decimals: ${opts.decimals}`);

      try {
        const { stablecoin, mintKeypair, signature } =
          await SolanaStablecoin.create(ctx.connection, ctx.wallet, {
            preset: opts.preset as Preset,
            name: opts.name,
            symbol: opts.symbol,
            uri: opts.uri,
            decimals: opts.decimals,
            supplyCap: opts.supplyCap ? new BN(opts.supplyCap) : undefined,
            transferFeeBasisPoints: opts.feeBps,
            maximumFee: opts.maxFee ? new BN(opts.maxFee) : undefined,
          });

        console.log(chalk.green("\nStablecoin created successfully!"));
        console.log(`  Mint:      ${chalk.yellow(mintKeypair.publicKey.toBase58())}`);
        console.log(`  Config:    ${stablecoin.configPda.toBase58()}`);
        console.log(`  Signature: ${signature}`);
        console.log(
          `\nSet environment variable: ${chalk.cyan(
            `export SSS_MINT=${mintKeypair.publicKey.toBase58()}`
          )}`
        );
      } catch (e: any) {
        console.error(chalk.red(`Error: ${e.message}`));
        process.exit(1);
      }
    });
}
