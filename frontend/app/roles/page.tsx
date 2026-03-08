"use client";

import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

const ROLES = ["admin", "minter", "freezer", "pauser", "burner", "blacklister", "seizer"] as const;

type OpResult = { success: true; signature: string } | { success: false; error: string };

async function callApi(
  method: string,
  path: string,
  body: Record<string, unknown> | null,
  apiKey: string
): Promise<OpResult | { roles?: { address: string; role: string; pda: string }[] }> {
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

export default function RolesPage() {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rolesList, setRolesList] = useState<{ address: string; role: string; pda: string }[] | null>(null);
  const [listMint, setListMint] = useState("");
  const key = apiKey || API_KEY;

  const doGrant = async (mint: string, address: string, role: string) => {
    setLoading(true);
    setResult(null);
    const r = await callApi("POST", "/roles/grant", { mint, address, role }, key);
    setResult(
      r && "success" in r && r.success && "signature" in r
        ? `Granted: ${r.signature}`
        : (r && "error" in r ? r.error : "") || ""
    );
    setLoading(false);
  };

  const doRevoke = async (mint: string, address: string, role: string) => {
    setLoading(true);
    setResult(null);
    const r = await callApi("POST", "/roles/revoke", { mint, address, role }, key);
    setResult(
      r && "success" in r && r.success && "signature" in r
        ? `Revoked: ${r.signature}`
        : (r && "error" in r ? r.error : "") || ""
    );
    setLoading(false);
  };

  const doList = async () => {
    if (!listMint.trim()) return;
    setLoading(true);
    setResult(null);
    setRolesList(null);
    const r = await callApi("GET", `/roles/list/${listMint.trim()}`, null, key);
    if (r && "roles" in r && r.roles) {
      setRolesList(r.roles);
      setResult(null);
    } else {
      setResult((r && "error" in r ? r.error : "Failed to fetch roles") || "Failed to fetch roles");
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>Roles</h1>
        <WalletMultiButton />
      </div>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Grant and revoke admin, minter, freezer, pauser, burner, blacklister, and seizer roles via the backend API.
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
            background: result.startsWith("Granted") || result.startsWith("Revoked") ? "#e8f5e9" : "#ffebee",
            color: result.startsWith("Granted") || result.startsWith("Revoked") ? "#2e7d32" : "#c62828",
          }}
        >
          {result}
        </div>
      )}

      <div style={{ display: "grid", gap: "1.5rem", maxWidth: "500px" }}>
        <div style={{ padding: "1rem", border: "1px solid #eee", borderRadius: "6px" }}>
          <strong style={{ display: "block", marginBottom: "0.75rem" }}>Grant Role</strong>
          <GrantRevokeForm
            action="grant"
            roles={ROLES}
            onSubmit={(mint, address, role) => doGrant(mint, address, role)}
            loading={loading}
          />
        </div>
        <div style={{ padding: "1rem", border: "1px solid #eee", borderRadius: "6px" }}>
          <strong style={{ display: "block", marginBottom: "0.75rem" }}>Revoke Role</strong>
          <GrantRevokeForm
            action="revoke"
            roles={ROLES}
            onSubmit={(mint, address, role) => doRevoke(mint, address, role)}
            loading={loading}
          />
        </div>
        <div style={{ padding: "1rem", border: "1px solid #eee", borderRadius: "6px" }}>
          <strong style={{ display: "block", marginBottom: "0.75rem" }}>List Roles</strong>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input
              value={listMint}
              onChange={(e) => setListMint(e.target.value)}
              placeholder="Mint address"
              style={{ flex: 1, padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
            />
            <button
              type="button"
              onClick={doList}
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
              List
            </button>
          </div>
          {rolesList && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
              {rolesList.length === 0 ? (
                <p style={{ color: "#666" }}>No roles found.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                  {rolesList.map((r, i) => (
                    <li key={i}>
                      {r.address} → {r.role}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GrantRevokeForm({
  action,
  roles,
  onSubmit,
  loading,
}: {
  action: string;
  roles: readonly string[];
  onSubmit: (mint: string, address: string, role: string) => void;
  loading: boolean;
}) {
  const [mint, setMint] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState(roles[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(mint, address, role);
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
      <div style={{ marginBottom: "0.5rem" }}>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
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
        {loading ? "..." : action === "grant" ? "Grant" : "Revoke"}
      </button>
    </form>
  );
}
