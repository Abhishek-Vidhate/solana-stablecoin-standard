"use client";

import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

type OpResult = { success: true; signature: string } | { success: false; error: string };

async function callApi(
  path: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<OpResult> {
  const key = apiKey || API_KEY;
  if (!key) {
    return { success: false, error: "API key required. Set NEXT_PUBLIC_API_KEY or enter below." };
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": key,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || data.message || String(res.status) };
    }
    return data.success ? { success: true, signature: data.signature } : { success: false, error: data.error || "Unknown error" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function OperationsPage() {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<OpResult | null>(null);
  const [loading, setLoading] = useState(false);

  const key = apiKey || API_KEY;

  const doOp = async (
    path: string,
    body: Record<string, unknown>
  ) => {
    setLoading(true);
    setResult(null);
    const r = await callApi(path, body, key);
    setResult(r);
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>Operations</h1>
        <WalletMultiButton />
      </div>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Mint, burn, freeze, thaw, pause, and seize tokens via the backend API. The backend uses its configured wallet to sign.
      </p>

      {!API_KEY && (
        <div style={{ marginBottom: "1.5rem", maxWidth: "400px" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
            API Key (X-API-KEY)
          </label>
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
            background: result.success ? "#e8f5e9" : "#ffebee",
            color: result.success ? "#2e7d32" : "#c62828",
          }}
        >
          {result.success ? (
            <span>Success: {result.signature}</span>
          ) : (
            <span>Error: {result.error}</span>
          )}
        </div>
      )}

      <div style={{ display: "grid", gap: "1.5rem", maxWidth: "500px" }}>
        <OpForm
          title="Mint"
          fields={[
            { name: "mint", label: "Mint address", placeholder: "Base58..." },
            { name: "recipient", label: "Recipient", placeholder: "Base58..." },
            { name: "amount", label: "Amount (raw)", placeholder: "1000000" },
          ]}
          onSubmit={(f) => doOp("/operations/mint", f)}
          loading={loading}
        />
        <OpForm
          title="Burn"
          fields={[
            { name: "mint", label: "Mint address", placeholder: "Base58..." },
            { name: "from", label: "From (token account owner)", placeholder: "Base58..." },
            { name: "amount", label: "Amount (raw)", placeholder: "1000000" },
          ]}
          onSubmit={(f) => doOp("/operations/burn", f)}
          loading={loading}
        />
        <OpForm
          title="Freeze"
          fields={[
            { name: "mint", label: "Mint address", placeholder: "Base58..." },
            { name: "account", label: "Token account (ATA)", placeholder: "Base58..." },
          ]}
          onSubmit={(f) => doOp("/operations/freeze", f)}
          loading={loading}
        />
        <OpForm
          title="Thaw"
          fields={[
            { name: "mint", label: "Mint address", placeholder: "Base58..." },
            { name: "account", label: "Token account (ATA)", placeholder: "Base58..." },
          ]}
          onSubmit={(f) => doOp("/operations/thaw", f)}
          loading={loading}
        />
        <OpForm
          title="Pause"
          fields={[{ name: "mint", label: "Mint address", placeholder: "Base58..." }]}
          onSubmit={(f) => doOp("/operations/pause", f)}
          loading={loading}
        />
        <OpForm
          title="Unpause"
          fields={[{ name: "mint", label: "Mint address", placeholder: "Base58..." }]}
          onSubmit={(f) => doOp("/operations/unpause", f)}
          loading={loading}
        />
        <OpForm
          title="Seize"
          fields={[
            { name: "mint", label: "Mint address", placeholder: "Base58..." },
            { name: "from", label: "From (token account)", placeholder: "Base58..." },
            { name: "to", label: "To (token account)", placeholder: "Base58..." },
            { name: "amount", label: "Amount (raw)", placeholder: "1000000" },
          ]}
          onSubmit={(f) => doOp("/operations/seize", f)}
          loading={loading}
        />
        <OpForm
          title="Fees Update (SSS-4)"
          fields={[
            { name: "mint", label: "Mint address", placeholder: "Base58..." },
            { name: "basisPoints", label: "Basis points (0-10000)", placeholder: "10" },
            { name: "maximumFee", label: "Maximum fee (raw)", placeholder: "1000000" },
          ]}
          onSubmit={(f) => doOp("/operations/fees/update", {
            mint: f.mint,
            basisPoints: parseInt(f.basisPoints, 10),
            maximumFee: f.maximumFee,
          })}
          loading={loading}
        />
        <OpForm
          title="Fees Withdraw (SSS-4)"
          fields={[
            { name: "mint", label: "Mint address", placeholder: "Base58..." },
            { name: "destination", label: "Destination (token account)", placeholder: "Base58..." },
          ]}
          onSubmit={(f) => doOp("/operations/fees/withdraw", {
            mint: f.mint,
            destination: f.destination,
          })}
          loading={loading}
        />
      </div>
    </div>
  );
}

function OpForm({
  title,
  fields,
  onSubmit,
  loading,
}: {
  title: string;
  fields: { name: string; label: string; placeholder: string }[];
  onSubmit: (values: Record<string, string>) => void;
  loading: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ padding: "1rem", border: "1px solid #eee", borderRadius: "6px" }}
    >
      <strong style={{ display: "block", marginBottom: "0.75rem" }}>{title}</strong>
      {fields.map(({ name, label, placeholder }) => (
        <div key={name} style={{ marginBottom: "0.5rem" }}>
          <label style={{ display: "block", fontSize: "0.85rem", color: "#666" }}>
            {label}
          </label>
          <input
            name={name}
            value={values[name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
            placeholder={placeholder}
            required
            style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: "0.5rem",
          padding: "0.5rem 1rem",
          borderRadius: "4px",
          border: "1px solid #333",
          background: "#333",
          color: "#fff",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "..." : title}
      </button>
    </form>
  );
}
