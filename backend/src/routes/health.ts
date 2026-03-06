import { Router, Request, Response } from "express";
import { SolanaService } from "../services/solana";

const router = Router();
const startedAt = Date.now();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const connection = SolanaService.get().getConnection();
    const slot = await connection.getSlot();
    res.json({
      status: "ok",
      solanaSlot: slot,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
    });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
