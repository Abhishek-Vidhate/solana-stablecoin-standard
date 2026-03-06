import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { SolanaService } from "../services/solana";
import { deriveConfigPda } from "@abhishek-vidhate/sss-token";
import { logger } from "../services/logger";

const router = Router();

const pubkeyStr = z.string().refine(
  (v) => {
    try { new PublicKey(v); return true; } catch { return false; }
  },
  { message: "Invalid Solana public key" }
);

const BlacklistAddBody = z.object({
  mint: pubkeyStr,
  address: pubkeyStr,
  reason: z.string().min(1).max(64),
});

const BlacklistRemoveBody = z.object({
  mint: pubkeyStr,
  address: pubkeyStr,
});

router.post("/blacklist/add", async (req: Request, res: Response) => {
  try {
    const body = BlacklistAddBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.compliance.blacklistAdd(
      wallet.publicKey,
      new PublicKey(body.address),
      body.reason
    );

    logger.info("Blacklist add", { mint: body.mint, address: body.address, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Blacklist add failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/blacklist/remove", async (req: Request, res: Response) => {
  try {
    const body = BlacklistRemoveBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.compliance.blacklistRemove(
      wallet.publicKey,
      new PublicKey(body.address)
    );

    logger.info("Blacklist remove", { mint: body.mint, address: body.address, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Blacklist remove failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/status/:mint/:address", async (req: Request<{ mint: string; address: string }>, res: Response) => {
  try {
    const { mint, address } = req.params;
    new PublicKey(mint);
    new PublicKey(address);

    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(mint);
    const blacklisted = await stable.compliance.isBlacklisted(
      new PublicKey(address)
    );

    res.json({ mint, address, blacklisted });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/audit-trail/:mint", async (req: Request<{ mint: string }>, res: Response) => {
  try {
    const { mint } = req.params;
    const mintPk = new PublicKey(mint);
    const [configPda] = deriveConfigPda(mintPk);

    const svc = SolanaService.get();
    const connection = svc.getConnection();
    const signatures = await connection.getSignaturesForAddress(configPda, {
      limit: 100,
    });

    res.json({
      mint,
      configPda: configPda.toBase58(),
      transactions: signatures.map((s) => ({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime,
        err: s.err,
        memo: s.memo,
      })),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
