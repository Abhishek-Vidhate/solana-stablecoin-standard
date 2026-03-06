import { Connection, PublicKey, Logs } from "@solana/web3.js";
import { SSS_CORE_PROGRAM_ID } from "@abhishek-vidhate/sss-token";
import { logger } from "./logger";

export class EventListener {
  private subscriptionId: number | null = null;

  constructor(private connection: Connection) {}

  start(): void {
    if (this.subscriptionId !== null) return;

    this.subscriptionId = this.connection.onLogs(
      SSS_CORE_PROGRAM_ID,
      (logs: Logs) => {
        if (logs.err) {
          logger.warn("Program log error", {
            signature: logs.signature,
            error: JSON.stringify(logs.err),
          });
          return;
        }

        for (const line of logs.logs) {
          if (line.startsWith("Program data:") || line.startsWith("Program log:")) {
            logger.info("Program event", {
              signature: logs.signature,
              log: line,
            });
          }
        }
      },
      "confirmed"
    );

    logger.info("Event listener started", {
      programId: SSS_CORE_PROGRAM_ID.toBase58(),
    });
  }

  stop(): void {
    if (this.subscriptionId !== null) {
      this.connection.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = null;
      logger.info("Event listener stopped");
    }
  }
}
