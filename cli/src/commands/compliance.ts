import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { createContext, loadStablecoin, resolveMint } from "../context";
import chalk from "chalk";

export function registerCompliance(program: Command) {
  const blacklist = program
    .command("blacklist")
    .description("Manage blacklist (SSS-2/4)");

  blacklist
    .command("add")
    .description("Add an address to the blacklist")
    .requiredOption("--address <address>", "Address to blacklist")
    .requiredOption("--reason <string>", "Reason for blacklisting")
    .option("--mint <address>", "Mint address")
    .action(async (opts, cmd) => {
      const parentOpts = cmd.parent!.parent!.opts();
      const ctx = createContext(parentOpts);
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      console.log(chalk.blue(`Blacklisting ${opts.address}...`));
      const sig = await stable.compliance.blacklistAdd(
        ctx.keypair.publicKey,
        new PublicKey(opts.address),
        opts.reason
      );
      console.log(chalk.green(`Blacklisted! Tx: ${sig}`));
    });

  blacklist
    .command("remove")
    .description("Remove an address from the blacklist")
    .requiredOption("--address <address>", "Address to unblacklist")
    .option("--mint <address>", "Mint address")
    .action(async (opts, cmd) => {
      const parentOpts = cmd.parent!.parent!.opts();
      const ctx = createContext(parentOpts);
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      console.log(chalk.blue(`Removing ${opts.address} from blacklist...`));
      const sig = await stable.compliance.blacklistRemove(
        ctx.keypair.publicKey,
        new PublicKey(opts.address)
      );
      console.log(chalk.green(`Removed! Tx: ${sig}`));
    });

  blacklist
    .command("check")
    .description("Check if an address is blacklisted")
    .requiredOption("--address <address>", "Address to check")
    .option("--mint <address>", "Mint address")
    .action(async (opts, cmd) => {
      const parentOpts = cmd.parent!.parent!.opts();
      const ctx = createContext(parentOpts);
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      const result = await stable.compliance.isBlacklisted(
        new PublicKey(opts.address)
      );
      if (result) {
        console.log(chalk.red(`${opts.address} is BLACKLISTED`));
      } else {
        console.log(chalk.green(`${opts.address} is NOT blacklisted`));
      }
    });
}
