import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server misconfigured: API_KEY not set" });
    return;
  }

  const provided = req.headers["x-api-key"];
  if (typeof provided !== "string") {
    res.status(401).json({ error: "Missing X-API-KEY header" });
    return;
  }

  const expected = Buffer.from(apiKey);
  const actual = Buffer.from(provided);

  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  ) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  next();
}
