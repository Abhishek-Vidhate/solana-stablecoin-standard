#!/usr/bin/env node

import { Command } from "commander";
import dotenv from "dotenv";
import { registerInit } from "./commands/init";
import { registerOperations } from "./commands/operations";
import { registerCompliance } from "./commands/compliance";
import { registerRoles } from "./commands/roles";

dotenv.config();

const program = new Command();

program
  .name("sss-token")
  .description("Solana Stablecoin Standard CLI")
  .version("0.1.0")
  .option("-u, --rpc-url <url>", "Solana RPC URL", process.env.SOLANA_RPC_URL)
  .option(
    "-k, --keypair-path <path>",
    "Path to keypair file",
    process.env.SOLANA_KEYPAIR
  );

registerInit(program);
registerOperations(program);
registerCompliance(program);
registerRoles(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
