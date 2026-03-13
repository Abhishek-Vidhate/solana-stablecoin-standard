"use client";

import { useState } from "react";
import WalletButton from "@/components/WalletButton";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type TxEntry = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  memo: string | null;
};

export default function HistoryPage() {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    mint: string;
    configPda: string;
    transactions: TxEntry[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mint.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API_BASE}/compliance/audit-trail/${mint.trim()}`, {
        headers: {},
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
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Audit <span className="solana-gradient">Registry</span></h1>
        <WalletButton />
      </div>
      
      <p className="text-muted max-w-2xl">
        Transparent on-chain audit trail. Investigate the transaction logs associated with a stablecoin's configuration authority.
      </p>

      <form
        onSubmit={fetchHistory}
        className="glass-card flex gap-4 max-w-2xl"
      >
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted uppercase tracking-wider">Stablecoin Mint</label>
          <input
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            placeholder="Search by Base58 address..."
            required
            className="input-field"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary self-end h-[46px]"
        >
          {loading ? "Decrypting..." : "Scan History"}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/50 text-red-400">
          <span className="font-bold text-sm uppercase mr-2">Error:</span> {error}
        </div>
      )}

      {data && (
        <div className="glass-card space-y-6">
          <div className="flex flex-col gap-1 border-l-2 border-[#9945FF] pl-4">
            <p className="text-xs text-muted uppercase tracking-widest font-bold">Config Authority PDA</p>
            <p className="font-mono text-sm text-white break-all">{data.configPda}</p>
            <p className="text-xs text-[#14F195] font-bold mt-1">
              Found {data.transactions.length} linked transactions
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Transaction Sig</th>
                  <th className="px-6 py-4">Slot</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.transactions.map((tx) => (
                  <tr key={tx.signature} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <a
                        href={explorerUrl(tx.signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-[#9945FF] hover:text-white transition-colors"
                      >
                        {tx.signature.slice(0, 24)}...
                      </a>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted">{tx.slot}</td>
                    <td className="px-6 py-4 text-xs">
                      {tx.blockTime
                        ? new Date(tx.blockTime * 1000).toLocaleString()
                        : "Processing"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        tx.err ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'
                      }`}>
                        {tx.err ? "Failed" : "Success"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
