import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { createContext, loadStablecoin, resolveMint } from "../context";
import chalk from "chalk";

export function registerOperations(program: Command) {
  program
    .command("mint")
    .description("Mint tokens to a recipient")
    .requiredOption("--to <address>", "Recipient address")
    .requiredOption("--amount <number>", "Amount to mint")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      console.log(chalk.blue(`Minting ${opts.amount} tokens...`));
      const sig = await stable.mintTokens({
        recipient: new PublicKey(opts.to),
        amount: new BN(opts.amount),
        minter: ctx.keypair.publicKey,
      });
      console.log(chalk.green(`Minted! Tx: ${sig}`));
    });

  program
    .command("burn")
    .description("Burn tokens from a token account")
    .requiredOption("--from <address>", "Token account to burn from")
    .requiredOption("--amount <number>", "Amount to burn")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      console.log(chalk.blue(`Burning ${opts.amount} tokens...`));
      const sig = await stable.burnTokens({
        from: new PublicKey(opts.from),
        amount: new BN(opts.amount),
        burner: ctx.keypair.publicKey,
      });
      console.log(chalk.green(`Burned! Tx: ${sig}`));
    });

  program
    .command("freeze")
    .description("Freeze a token account")
    .requiredOption("--account <address>", "Token account to freeze")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      console.log(chalk.blue("Freezing account..."));
      const sig = await stable.freezeAccount(
        ctx.keypair.publicKey,
        new PublicKey(opts.account)
      );
      console.log(chalk.green(`Frozen! Tx: ${sig}`));
    });

  program
    .command("thaw")
    .description("Thaw a frozen token account")
    .requiredOption("--account <address>", "Token account to thaw")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      console.log(chalk.blue("Thawing account..."));
      const sig = await stable.thawAccount(
        ctx.keypair.publicKey,
        new PublicKey(opts.account)
      );
      console.log(chalk.green(`Thawed! Tx: ${sig}`));
    });

  program
    .command("pause")
    .description("Pause all operations")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      const sig = await stable.pause(ctx.keypair.publicKey);
      console.log(chalk.green(`Paused! Tx: ${sig}`));
    });

  program
    .command("unpause")
    .description("Unpause operations")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      const sig = await stable.unpause(ctx.keypair.publicKey);
      console.log(chalk.green(`Unpaused! Tx: ${sig}`));
    });

  program
    .command("seize")
    .description("Seize tokens via permanent delegate (SSS-2/4)")
    .requiredOption("--from <address>", "Source token account")
    .requiredOption("--to <address>", "Destination token account")
    .requiredOption("--amount <number>", "Amount to seize")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      console.log(chalk.blue(`Seizing ${opts.amount} tokens...`));
      const sig = await stable.seize({
        seizer: ctx.keypair.publicKey,
        from: new PublicKey(opts.from),
        to: new PublicKey(opts.to),
        amount: new BN(opts.amount),
      });
      console.log(chalk.green(`Seized! Tx: ${sig}`));
    });

  program
    .command("status")
    .description("Show stablecoin config and status")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      const info = await stable.getInfo();
      console.log(chalk.bold("\nStablecoin Status"));
      console.log("─".repeat(50));
      console.log(`  Preset:     SSS-${info.preset}`);
      console.log(`  Name:       ${info.name}`);
      console.log(`  Symbol:     ${info.symbol}`);
      console.log(`  Decimals:   ${info.decimals}`);
      console.log(`  Mint:       ${info.mint.toBase58()}`);
      console.log(`  Authority:  ${info.authority.toBase58()}`);
      console.log(`  Paused:     ${info.paused ? chalk.red("YES") : chalk.green("NO")}`);
      console.log(`  Supply Cap: ${info.supplyCap ? info.supplyCap.toString() : "None"}`);
      console.log(`  Minted:     ${info.totalMinted.toString()}`);
      console.log(`  Burned:     ${info.totalBurned.toString()}`);
      console.log(`  Supply:     ${info.currentSupply.toString()}`);
      console.log(`  Admins:     ${info.adminCount}`);
      if (info.preset === 4) {
        console.log(`  Fee BPS:    ${info.transferFeeBasisPoints}`);
        console.log(`  Max Fee:    ${info.maximumFee.toString()}`);
      }
    });

  program
    .command("supply")
    .description("Show current total supply")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      const supply = await stable.getTotalSupply();
      console.log(`Total supply: ${supply.toString()}`);
    });
}
