"use client";

import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

type TxEntry = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  memo: string | null;
};

export default function HistoryPage() {
  const [apiKey, setApiKey] = useState("");
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    mint: string;
    configPda: string;
    transactions: TxEntry[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = apiKey || API_KEY;

  const fetchHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mint.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API_BASE}/compliance/audit-trail/${mint.trim()}`, {
        headers: key ? { "X-API-KEY": key } : {},
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || String(res.status));
      } else {
        setData(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const explorerUrl = (sig: string) =>
    `https://explorer.solana.com/tx/${sig}?cluster=${process.env.NEXT_PUBLIC_RPC_URL?.includes("devnet") ? "devnet" : "mainnet-beta"}`;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>Audit Log</h1>
        <WalletMultiButton />
      </div>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        View transaction history for a stablecoin config PDA. Enter mint address and fetch.
      </p>

      {!API_KEY && (
        <div style={{ marginBottom: "1.5rem", maxWidth: "400px" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>API Key (optional for audit-trail)</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter backend API key"
            style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
      )}

      <form
        onSubmit={fetchHistory}
        style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", maxWidth: "500px" }}
      >
        <input
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="Mint address"
          required
          style={{ flex: 1, padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            border: "1px solid #333",
            background: "#333",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Fetch"}
        </button>
      </form>

      {error && (
        <div style={{ padding: "1rem", marginBottom: "1rem", borderRadius: "6px", background: "#ffebee", color: "#c62828" }}>
          {error}
        </div>
      )}

      {data && (
        <div style={{ overflowX: "auto" }}>
          <p style={{ marginBottom: "0.5rem", color: "#666" }}>
            Config PDA: {data.configPda} — {data.transactions.length} transactions
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #eee" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Signature</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Slot</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Block Time</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx) => (
                <tr key={tx.signature} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <a
                      href={explorerUrl(tx.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#1976d2", textDecoration: "none" }}
                    >
                      {tx.signature.slice(0, 16)}...
                    </a>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{tx.slot}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {tx.blockTime
                      ? new Date(tx.blockTime * 1000).toISOString()
                      : "—"}
                  </td>
                  <td style={{ padding: "0.5rem", color: tx.err ? "#c62828" : "#2e7d32" }}>
                    {tx.err ? "Failed" : "Success"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
