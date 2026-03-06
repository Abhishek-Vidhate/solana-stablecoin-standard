import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { Role, ROLE_LABELS } from "@abhishek-vidhate/sss-token";
import { createContext, loadStablecoin, resolveMint } from "../context";
import chalk from "chalk";

function parseRole(roleStr: string): Role {
  const map: Record<string, Role> = {
    admin: Role.Admin,
    minter: Role.Minter,
    freezer: Role.Freezer,
    pauser: Role.Pauser,
    burner: Role.Burner,
    blacklister: Role.Blacklister,
    seizer: Role.Seizer,
  };
  const role = map[roleStr.toLowerCase()];
  if (role === undefined) {
    console.error(`Invalid role: ${roleStr}. Valid: ${Object.keys(map).join(", ")}`);
    process.exit(1);
  }
  return role;
}

export function registerRoles(program: Command) {
  const roles = program.command("roles").description("Manage roles");

  roles
    .command("grant")
    .description("Grant a role to an address")
    .requiredOption("--address <address>", "Address to grant role to")
    .requiredOption("--role <role>", "Role (admin|minter|freezer|pauser|burner|blacklister|seizer)")
    .option("--mint <address>", "Mint address")
    .action(async (opts, cmd) => {
      const parentOpts = cmd.parent!.parent!.opts();
      const ctx = createContext(parentOpts);
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      const role = parseRole(opts.role);
      console.log(chalk.blue(`Granting ${ROLE_LABELS[role]} role to ${opts.address}...`));
      const sig = await stable.roles.grant(
        ctx.keypair.publicKey,
        new PublicKey(opts.address),
        role
      );
      console.log(chalk.green(`Granted! Tx: ${sig}`));
    });

  roles
    .command("revoke")
    .description("Revoke a role from an address")
    .requiredOption("--address <address>", "Address to revoke role from")
    .requiredOption("--role <role>", "Role to revoke")
    .option("--mint <address>", "Mint address")
    .action(async (opts, cmd) => {
      const parentOpts = cmd.parent!.parent!.opts();
      const ctx = createContext(parentOpts);
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      const role = parseRole(opts.role);
      console.log(chalk.blue(`Revoking ${ROLE_LABELS[role]} role from ${opts.address}...`));
      const sig = await stable.roles.revoke(
        ctx.keypair.publicKey,
        new PublicKey(opts.address),
        role
      );
      console.log(chalk.green(`Revoked! Tx: ${sig}`));
    });

  const minters = program.command("minters").description("Manage minters");

  minters
    .command("add")
    .description("Add a minter")
    .requiredOption("--address <address>", "Minter address")
    .option("--quota <number>", "Minting quota")
    .option("--mint <address>", "Mint address")
    .action(async (opts, cmd) => {
      const parentOpts = cmd.parent!.parent!.opts();
      const ctx = createContext(parentOpts);
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      console.log(chalk.blue(`Adding minter ${opts.address}...`));
      const sig = await stable.roles.grant(
        ctx.keypair.publicKey,
        new PublicKey(opts.address),
        Role.Minter
      );
      console.log(chalk.green(`Minter added! Tx: ${sig}`));

      if (opts.quota) {
        const sig2 = await stable.roles.updateMinterQuota(
          ctx.keypair.publicKey,
          new PublicKey(opts.address),
          new BN(opts.quota)
        );
        console.log(chalk.green(`Quota set! Tx: ${sig2}`));
      }
    });

  minters
    .command("remove")
    .description("Remove a minter")
    .requiredOption("--address <address>", "Minter address")
    .option("--mint <address>", "Mint address")
    .action(async (opts, cmd) => {
      const parentOpts = cmd.parent!.parent!.opts();
      const ctx = createContext(parentOpts);
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      console.log(chalk.blue(`Removing minter ${opts.address}...`));
      const sig = await stable.roles.revoke(
        ctx.keypair.publicKey,
        new PublicKey(opts.address),
        Role.Minter
      );
      console.log(chalk.green(`Minter removed! Tx: ${sig}`));
    });

  program
    .command("fees")
    .description("Manage transfer fees (SSS-4)")
    .option("--update-bps <number>", "New fee basis points", parseInt)
    .option("--update-max <number>", "New maximum fee")
    .option("--withdraw-to <address>", "Withdraw fees to this token account")
    .option("--mint <address>", "Mint address")
    .action(async (opts) => {
      const ctx = createContext(program.opts());
      const mint = resolveMint(opts);
      const stable = loadStablecoin(ctx, mint);

      if (opts.updateBps !== undefined || opts.updateMax !== undefined) {
        const feeConfig = await stable.fees.getConfig();
        const bps = opts.updateBps ?? feeConfig.basisPoints;
        const max = opts.updateMax ? new BN(opts.updateMax) : feeConfig.maximumFee;

        console.log(chalk.blue(`Updating fee: ${bps} bps, max ${max.toString()}...`));
        const sig = await stable.fees.updateFee(ctx.keypair.publicKey, bps, max);
        console.log(chalk.green(`Fee updated! Tx: ${sig}`));
      } else if (opts.withdrawTo) {
        console.log(chalk.blue("Withdrawing withheld fees..."));
        const sig = await stable.fees.withdrawWithheld(
          ctx.keypair.publicKey,
          new PublicKey(opts.withdrawTo)
        );
        console.log(chalk.green(`Fees withdrawn! Tx: ${sig}`));
      } else {
        const feeConfig = await stable.fees.getConfig();
        console.log(`Fee BPS:    ${feeConfig.basisPoints}`);
        console.log(`Max Fee:    ${feeConfig.maximumFee.toString()}`);
      }
    });
}
