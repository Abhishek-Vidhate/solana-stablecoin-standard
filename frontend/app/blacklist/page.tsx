"use client";

import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

type OpResult = { success: true; signature: string } | { success: false; error: string };

async function callApi(
  method: string,
  path: string,
  body: Record<string, unknown> | null,
  apiKey: string
): Promise<OpResult | { blacklisted?: boolean }> {
  const key = apiKey || API_KEY;
  if (!key) {
    return { success: false, error: "API key required. Set NEXT_PUBLIC_API_KEY or enter below." };
  }
  try {
    const opts: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": key,
      },
    };
    if (body && method === "POST") opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || data.message || String(res.status) };
    }
    return data;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function BlacklistPage() {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<boolean | null>(null);
  const key = apiKey || API_KEY;

  const doAdd = async (mint: string, address: string, reason: string) => {
    setLoading(true);
    setResult(null);
    const r = await callApi("POST", "/compliance/blacklist/add", { mint, address, reason }, key);
    setResult(
      r && "success" in r && r.success && "signature" in r
        ? `Added: ${r.signature}`
        : (r && "error" in r ? r.error : "") || ""
    );
    setLoading(false);
  };

  const doRemove = async (mint: string, address: string) => {
    setLoading(true);
    setResult(null);
    const r = await callApi("POST", "/compliance/blacklist/remove", { mint, address }, key);
    setResult(
      r && "success" in r && r.success && "signature" in r
        ? `Removed: ${r.signature}`
        : (r && "error" in r ? r.error : "") || ""
    );
    setLoading(false);
  };

  const doCheck = async (mint: string, address: string) => {
    setLoading(true);
    setResult(null);
    setCheckResult(null);
    const r = await callApi("GET", `/compliance/status/${mint}/${address}`, null, key);
    if (r && "blacklisted" in r) {
      setCheckResult(r.blacklisted ?? null);
      setResult(null);
    } else {
      setResult((r && "error" in r ? r.error : "Failed to check") || "Failed to check");
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>Blacklist</h1>
        <WalletMultiButton />
      </div>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Add or remove addresses from the blacklist (SSS-2 and SSS-4 only). Check if an address is blacklisted.
      </p>

      {!API_KEY && (
        <div style={{ marginBottom: "1.5rem", maxWidth: "400px" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter backend API key"
            style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
      )}

      {result && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            borderRadius: "6px",
            background: result.startsWith("Added") || result.startsWith("Removed") ? "#e8f5e9" : "#ffebee",
            color: result.startsWith("Added") || result.startsWith("Removed") ? "#2e7d32" : "#c62828",
          }}
        >
          {result}
        </div>
      )}

      {checkResult !== null && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            borderRadius: "6px",
            background: "#e3f2fd",
            color: "#1565c0",
          }}
        >
          Address is {checkResult ? "blacklisted" : "not blacklisted"}.
        </div>
      )}

      <div style={{ display: "grid", gap: "1.5rem", maxWidth: "500px" }}>
        <div style={{ padding: "1rem", border: "1px solid #eee", borderRadius: "6px" }}>
          <strong style={{ display: "block", marginBottom: "0.75rem" }}>Add to Blacklist</strong>
          <BlacklistForm
            action="add"
            onSubmit={(mint, address, reason) => doAdd(mint, address, reason || "compliance")}
            loading={loading}
          />
        </div>
        <div style={{ padding: "1rem", border: "1px solid #eee", borderRadius: "6px" }}>
          <strong style={{ display: "block", marginBottom: "0.75rem" }}>Remove from Blacklist</strong>
          <BlacklistForm
            action="remove"
            onSubmit={(mint, address) => doRemove(mint, address)}
            loading={loading}
          />
        </div>
        <div style={{ padding: "1rem", border: "1px solid #eee", borderRadius: "6px" }}>
          <strong style={{ display: "block", marginBottom: "0.75rem" }}>Check Status</strong>
          <BlacklistForm
            action="check"
            onSubmit={(mint, address) => doCheck(mint, address)}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

function BlacklistForm({
  action,
  onSubmit,
  loading,
}: {
  action: "add" | "remove" | "check";
  onSubmit: (mint: string, address: string, reason?: string) => void;
  loading: boolean;
}) {
  const [mint, setMint] = useState("");
  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("compliance");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(mint, address, action === "add" ? reason : undefined);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: "0.5rem" }}>
        <input
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="Mint address"
          required
          style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
        />
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address"
          required
          style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
        />
      </div>
      {action === "add" && (
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
      )}
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
        {loading ? "..." : action === "add" ? "Add" : action === "remove" ? "Remove" : "Check"}
      </button>
    </form>
  );
}
