"use client";

import { useState } from "react";
import WalletButton from "@/components/WalletButton";
import { parseProgramError } from "@/lib/errors";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type OpResult = { success: true; signature: string } | { success: false; error: string };

async function callApi(
  method: string,
  path: string,
  body: Record<string, unknown> | null
): Promise<OpResult | { blacklisted?: boolean }> {
  try {
    const opts: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (body && method === "POST") opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: parseProgramError(data.error || data.message || String(res.status)) };
    }
    return data;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function BlacklistPage() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<boolean | null>(null);

  const doAdd = async (mint: string, address: string, reason: string) => {
    setLoading(true);
    setResult(null);
    const r = await callApi("POST", "/compliance/blacklist/add", { mint, address, reason });
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
    const r = await callApi("POST", "/compliance/blacklist/remove", { mint, address });
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
    const r = await callApi("GET", `/compliance/status/${mint}/${address}`, null);
    if (r && "blacklisted" in r) {
      setCheckResult(r.blacklisted ?? null);
      setResult(null);
    } else {
      setResult((r && "error" in r ? r.error : "Failed to check") || "Failed to check");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Compliance <span className="solana-gradient">Blacklist</span></h1>
        <WalletButton />
      </div>
      
      <p className="text-muted max-w-2xl">
        Enforce regulatory compliance by managing blacklisted addresses for SSS-2 and SSS-4 tokens. 
        Blacklisted addresses are restricted from transferring or receiving tokens.
      </p>

      {result && (
        <div
          className={`p-4 rounded-xl border ${
            result.startsWith("Added") || result.startsWith("Removed")
              ? "bg-green-500/10 border-green-500/50 text-green-400"
              : "bg-red-500/10 border-red-500/50 text-red-400"
          }`}
        >
          {result}
        </div>
      )}

      {checkResult !== null && (
        <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/50 text-blue-400 flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${checkResult ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-sm font-medium">
            Status: This address is {checkResult ? "currently BLACKLISTED" : "AUTHORIZED for transactions"}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
        <div className="glass-card flex flex-col gap-4">
          <h3 className="text-lg font-bold">Restrict Address</h3>
          <BlacklistForm
            action="add"
            onSubmit={(mint, address, reason) => doAdd(mint, address, reason || "compliance")}
            loading={loading}
          />
        </div>
        
        <div className="glass-card flex flex-col gap-4">
          <h3 className="text-lg font-bold">Pardon Address</h3>
          <BlacklistForm
            action="remove"
            onSubmit={(mint, address) => doRemove(mint, address)}
            loading={loading}
          />
        </div>

        <div className="glass-card flex flex-col gap-4">
          <h3 className="text-lg font-bold">Query Status</h3>
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted uppercase tracking-wider">Mint Address</label>
          <input
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            placeholder="Base58 address"
            required
            className="input-field text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted uppercase tracking-wider">Target Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Wallet to investigate"
            required
            className="input-field text-sm"
          />
        </div>
        {action === "add" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Reason Code</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Sanctioned Account"
              className="input-field text-sm"
            />
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn-primary mt-2 disabled:opacity-50"
      >
        {loading ? "Processing..." : action === "add" ? "Confirm Restriction" : action === "remove" ? "Confirm Pardon" : "Run Query"}
      </button>
    </form>
  );
}
