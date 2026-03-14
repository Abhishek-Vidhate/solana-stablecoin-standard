import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { z } from "zod";
import { SolanaStablecoin } from "@stbr/sss-token";
import { SolanaService } from "../services/solana";
import { logger } from "../services/logger";

const router = Router();

const pubkeyStr = z.string().refine(
  (v) => {
    try { new PublicKey(v); return true; } catch { return false; }
  },
  { message: "Invalid Solana public key" }
);

const MintBody = z.object({
  mint: pubkeyStr,
  recipient: pubkeyStr,
  amount: z.string().or(z.number()),
});

const BurnBody = z.object({
  mint: pubkeyStr,
  from: pubkeyStr,
  amount: z.string().or(z.number()),
});

const FreezeBody = z.object({
  mint: pubkeyStr,
  account: pubkeyStr,
});

const ThawBody = z.object({
  mint: pubkeyStr,
  account: pubkeyStr,
});

const PauseBody = z.object({ mint: pubkeyStr });
const UnpauseBody = z.object({ mint: pubkeyStr });

const SeizeBody = z.object({
  mint: pubkeyStr,
  from: pubkeyStr,
  to: pubkeyStr,
  amount: z.string().or(z.number()),
});

const FeesUpdateBody = z.object({
  mint: pubkeyStr,
  basisPoints: z.number().min(0).max(10000),
  maximumFee: z.string().or(z.number()),
});

const FeesWithdrawBody = z.object({
  mint: pubkeyStr,
  destination: pubkeyStr,
  sources: z.array(pubkeyStr).optional(),
});

// ----------------------------------------------------------------------
// POST /operations/init
// ----------------------------------------------------------------------

const InitBody = z.object({
  preset: z.number().min(1).max(4),
  name: z.string().min(1),
  symbol: z.string().min(1),
  uri: z.string(),
  decimals: z.number().min(0).max(9),
  supplyCap: z.string().or(z.number()).optional(),
  oracleFeedId: z.array(z.number()).optional(),
  transferFeeBasisPoints: z.number().optional(),
  maximumFee: z.string().or(z.number()).optional(),
});

router.post("/init", async (req: Request, res: Response) => {
  try {
    const body = InitBody.parse(req.body);
    const svc = SolanaService.get();
    
    // SolanaStablecoin.create needs the full config object
    const { stablecoin, mintKeypair, signature } = await SolanaStablecoin.create(
      svc.getConnection(),
      svc.getWallet(),
      {
        preset: body.preset,
        name: body.name,
        symbol: body.symbol,
        uri: body.uri,
        decimals: body.decimals,
        supplyCap: body.supplyCap ? new BN(body.supplyCap.toString()) : undefined,
        oracleFeedId: body.oracleFeedId,
        transferFeeBasisPoints: body.transferFeeBasisPoints,
        maximumFee: body.maximumFee ? new BN(body.maximumFee.toString()) : undefined,
      }
    );

    logger.info("Init executed", { 
      preset: body.preset, 
      mint: mintKeypair.publicKey.toBase58(), 
      signature 
    });
    
    res.json({ 
      success: true, 
      mint: mintKeypair.publicKey.toBase58(),
      signature 
    });
  } catch (err) {
    logger.error("Init failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/mint", async (req: Request, res: Response) => {
  try {
    const body = MintBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.mintTokens({
      minter: wallet.publicKey,
      recipient: new PublicKey(body.recipient),
      amount: new BN(body.amount.toString()),
    });

    logger.info("Mint executed", { mint: body.mint, recipient: body.recipient, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Mint failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/burn", async (req: Request, res: Response) => {
  try {
    const body = BurnBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.burnTokens({
      burner: wallet.publicKey,
      from: new PublicKey(body.from),
      amount: new BN(body.amount.toString()),
    });

    logger.info("Burn executed", { mint: body.mint, from: body.from, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Burn failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/freeze", async (req: Request, res: Response) => {
  try {
    const body = FreezeBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.freezeAccount(
      wallet.publicKey,
      new PublicKey(body.account)
    );

    logger.info("Freeze executed", { mint: body.mint, account: body.account, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Freeze failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/thaw", async (req: Request, res: Response) => {
  try {
    const body = ThawBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.thawAccount(
      wallet.publicKey,
      new PublicKey(body.account)
    );

    logger.info("Thaw executed", { mint: body.mint, account: body.account, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Thaw failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/pause", async (req: Request, res: Response) => {
  try {
    const body = PauseBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.pause(wallet.publicKey);

    logger.info("Pause executed", { mint: body.mint, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Pause failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/unpause", async (req: Request, res: Response) => {
  try {
    const body = UnpauseBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.unpause(wallet.publicKey);

    logger.info("Unpause executed", { mint: body.mint, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Unpause failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/seize", async (req: Request, res: Response) => {
  try {
    const body = SeizeBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.seize({
      seizer: wallet.publicKey,
      from: new PublicKey(body.from),
      to: new PublicKey(body.to),
      amount: new BN(body.amount.toString()),
    });

    logger.info("Seize executed", { mint: body.mint, from: body.from, to: body.to, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Seize failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/fees/update", async (req: Request, res: Response) => {
  try {
    const body = FeesUpdateBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const signature = await stable.fees.updateFee(
      wallet.publicKey,
      body.basisPoints,
      new BN(body.maximumFee.toString())
    );

    logger.info("Fees update executed", { mint: body.mint, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Fees update failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/fees/withdraw", async (req: Request, res: Response) => {
  try {
    const body = FeesWithdrawBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();

    const sources = body.sources?.map((s) => new PublicKey(s));
    const signature = await stable.fees.withdrawWithheld(
      wallet.publicKey,
      new PublicKey(body.destination),
      sources
    );

    logger.info("Fees withdraw executed", { mint: body.mint, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Fees withdraw failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
