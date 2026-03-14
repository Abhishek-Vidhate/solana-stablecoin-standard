import { logger } from "./logger";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

export async function sendWebhook(
  url: string,
  payload: object
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        logger.debug("Webhook delivered", { url, attempt });
        return;
      }

      logger.warn("Webhook non-OK response", {
        url,
        status: res.status,
        attempt,
      });
    } catch (err) {
      logger.warn("Webhook delivery failed", {
        url,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  logger.error("Webhook exhausted all retries", { url });
}
