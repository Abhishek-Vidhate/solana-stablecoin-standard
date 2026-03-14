import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { SolanaService } from "../services/solana";
import { Role, SSS_CORE_PROGRAM_ID } from "@stbr/sss-token";
import { deriveConfigPda } from "@stbr/sss-token";
import { logger } from "../services/logger";

const router = Router();

const pubkeyStr = z.string().refine(
  (v) => {
    try { new PublicKey(v); return true; } catch { return false; }
  },
  { message: "Invalid Solana public key" }
);

const ROLE_NAMES: Record<number, string> = {
  [Role.Admin]: "admin",
  [Role.Minter]: "minter",
  [Role.Freezer]: "freezer",
  [Role.Pauser]: "pauser",
  [Role.Burner]: "burner",
  [Role.Blacklister]: "blacklister",
  [Role.Seizer]: "seizer",
};

const roleStr = z.enum([
  "admin", "minter", "freezer", "pauser", "burner", "blacklister", "seizer",
]);

const GrantBody = z.object({
  mint: pubkeyStr,
  address: pubkeyStr,
  role: roleStr,
});

const RevokeBody = z.object({
  mint: pubkeyStr,
  address: pubkeyStr,
  role: roleStr,
});

function parseRole(role: string): Role {
  const map: Record<string, Role> = {
    admin: Role.Admin,
    minter: Role.Minter,
    freezer: Role.Freezer,
    pauser: Role.Pauser,
    burner: Role.Burner,
    blacklister: Role.Blacklister,
    seizer: Role.Seizer,
  };
  const r = map[role.toLowerCase()];
  if (r === undefined) throw new Error(`Invalid role: ${role}`);
  return r;
}

router.post("/grant", async (req: Request, res: Response) => {
  try {
    const body = GrantBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();
    const role = parseRole(body.role);

    const signature = await stable.roles.grant(
      wallet.publicKey,
      new PublicKey(body.address),
      role
    );

    logger.info("Role granted", { mint: body.mint, address: body.address, role: body.role, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Role grant failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/revoke", async (req: Request, res: Response) => {
  try {
    const body = RevokeBody.parse(req.body);
    const svc = SolanaService.get();
    const stable = svc.loadStablecoin(body.mint);
    const wallet = svc.getWallet();
    const role = parseRole(body.role);

    const signature = await stable.roles.revoke(
      wallet.publicKey,
      new PublicKey(body.address),
      role
    );

    logger.info("Role revoked", { mint: body.mint, address: body.address, role: body.role, signature });
    res.json({ success: true, signature });
  } catch (err) {
    logger.error("Role revoke failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/list/:mint", async (req: Request<{ mint: string }>, res: Response) => {
  try {
    const { mint } = req.params;
    const mintPk = new PublicKey(mint);
    const [configPda] = deriveConfigPda(mintPk);

    const svc = SolanaService.get();
    const connection = svc.getConnection();

    const accounts = await connection.getProgramAccounts(SSS_CORE_PROGRAM_ID,
      {
        filters: [
          { dataSize: 131 },
          {
            memcmp: {
              offset: 8,
              bytes: configPda.toBase58(),
            },
          },
        ],
      }
    );

    const roles: { address: string; role: string; pda: string }[] = [];
    for (const { pubkey, account } of accounts) {
      const data = account.data;
      if (data.length < 73) continue;
      const address = new PublicKey(data.slice(40, 72));
      const roleByte = data[72];
      const roleName = ROLE_NAMES[roleByte] ?? `unknown(${roleByte})`;
      roles.push({
        address: address.toBase58(),
        role: roleName,
        pda: pubkey.toBase58(),
      });
    }

    res.json({ mint, configPda: configPda.toBase58(), roles });
  } catch (err) {
    logger.error("Roles list failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
