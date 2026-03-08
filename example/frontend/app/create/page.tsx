"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { SolanaStablecoin, Preset } from "@abhishek-vidhate/sss-token";
import type { Wallet } from "@coral-xyz/anchor";

export default function CreatePage() {
  const { connection } = useConnection();
  const walletContext = useWallet();
  const [preset, setPreset] = useState<string>("1");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState("6");
  const [result, setResult] = useState<{ success: boolean; mint?: string; signature?: string; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletContext.publicKey || !walletContext.signTransaction) {
      setResult({ success: false, error: "Connect your wallet first" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const wallet = {
        publicKey: walletContext.publicKey,
        signTransaction: walletContext.signTransaction,
        signAllTransactions: walletContext.signAllTransactions!,
      } as Wallet;
      const presetNum = parseInt(preset, 10) as 1 | 2 | 4;
      if (![1, 2, 4].includes(presetNum)) {
        throw new Error("Preset must be 1, 2, or 4");
      }
      const { stablecoin, mintKeypair, signature } = await SolanaStablecoin.create(
        connection,
        wallet,
        {
          preset: presetNum as Preset,
          name: name.trim(),
          symbol: symbol.trim(),
          uri: "",
          decimals: parseInt(decimals, 10),
        }
      );
      setResult({
        success: true,
        mint: mintKeypair.publicKey.toBase58(),
        signature,
      });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>Create Stablecoin</h1>
        <WalletMultiButton />
      </div>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Create a new stablecoin using your connected wallet. Presets: 1 (basic), 2 (compliant + hook), 4 (with fees).
      </p>

      {result && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            borderRadius: "6px",
            background: result.success ? "#e8f5e9" : "#ffebee",
            color: result.success ? "#2e7d32" : "#c62828",
          }}
        >
          {result.success ? (
            <div>
              <p><strong>Mint:</strong> {result.mint}</p>
              <p><strong>Signature:</strong> {result.signature}</p>
            </div>
          ) : (
            <span>Error: {result.error}</span>
          )}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        style={{ maxWidth: "400px", padding: "1.5rem", border: "1px solid #eee", borderRadius: "8px" }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Preset</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option value="1">1 — Basic (SSS-1)</option>
            <option value="2">2 — Compliant + Hook (SSS-2)</option>
            <option value="4">4 — With Fees (SSS-4)</option>
          </select>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My USD"
            required
            style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="MUSD"
            required
            style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Decimals</label>
          <input
            type="number"
            value={decimals}
            onChange={(e) => setDecimals(e.target.value)}
            min={0}
            max={9}
            style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !walletContext.connected}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            border: "1px solid #333",
            background: "#333",
            color: "#fff",
            cursor: loading || !walletContext.connected ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating..." : walletContext.connected ? "Create" : "Connect Wallet"}
        </button>
      </form>
    </div>
  );
}
