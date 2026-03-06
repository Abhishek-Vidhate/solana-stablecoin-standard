import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";

import { logger } from "./services/logger";
import { SolanaService } from "./services/solana";
import { EventListener } from "./services/event-listener";
import { requireApiKey } from "./middleware/auth";
import { createRateLimiter } from "./middleware/rate-limit";

import healthRouter from "./routes/health";
import operationsRouter from "./routes/operations";
import complianceRouter from "./routes/compliance";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(createRateLimiter(60_000, 30));

app.use("/health", healthRouter);

app.use("/operations", requireApiKey, operationsRouter);
app.use("/compliance", requireApiKey, complianceRouter);

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const RPC_URL = process.env.SOLANA_RPC_URL ?? "http://localhost:8899";
const KEYPAIR_PATH =
  process.env.KEYPAIR_PATH ?? "~/.config/solana/id.json";

SolanaService.init(RPC_URL, KEYPAIR_PATH);

const eventListener = new EventListener(
  SolanaService.get().getConnection()
);
eventListener.start();

app.listen(PORT, () => {
  logger.info(`SSS Backend listening on port ${PORT}`, {
    rpc: RPC_URL,
    wallet: SolanaService.get().getWallet().publicKey.toBase58(),
  });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  eventListener.stop();
  process.exit(0);
});
