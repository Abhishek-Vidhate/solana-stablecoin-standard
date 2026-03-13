"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";
import { parseProgramError } from "@/lib/errors";
import { SolanaStablecoin, Preset } from "@stbr/sss-token";
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
        error: parseProgramError(err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Stablecoin <span className="solana-gradient">Architect</span></h1>
        <WalletButton />
      </div>
      
      <p className="text-muted max-w-2xl">
        Deploy a new programmable stablecoin mint to the Solana blockchain. Choose a standard preset to define compliance and operational logic.
      </p>

      {result && (
        <div
          className={`p-4 rounded-xl border ${
            result.success 
              ? "bg-green-500/10 border-green-500/50 text-green-400" 
              : "bg-red-500/10 border-red-500/50 text-red-400"
          }`}
        >
          {result.success ? (
            <div className="flex flex-col gap-2">
              <span className="font-bold text-sm uppercase tracking-wider">Deployment Successful</span>
              <div className="space-y-1">
                <p className="text-xs font-mono break-all opacity-80">Mint: {result.mint}</p>
                <p className="text-xs font-mono break-all opacity-80">Sig: {result.signature}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-sm uppercase tracking-wider">Deployment Failed</span>
              <span className="text-sm">{result.error}</span>
            </div>
          )}
        </div>
      )}

      <div className="max-w-xl">
        <form
          onSubmit={handleCreate}
          className="glass-card flex flex-col gap-6"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted uppercase tracking-wider">Protocol Preset</label>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="input-field appearance-none cursor-pointer"
              >
                <option value="1" className="bg-[#111]">SSS-1: Basic Infrastructure</option>
                <option value="2" className="bg-[#111]">SSS-2: Compliant with Hook</option>
                <option value="4" className="bg-[#111]">SSS-4: Dynamic Fee Structure</option>
              </select>
              <p className="text-[10px] text-muted italic mt-1">
                {preset === "1" ? "Ideal for basic liquidity. Includes standard mint/burn/freeze." : 
                 preset === "2" ? "Enterprise compliance. Requires transfer hooks for blacklist checks." : 
                 "Revenue-generating. Integrated transfer fees for the issuer."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted uppercase tracking-wider">Token Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Solana USD"
                  required
                  className="input-field"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted uppercase tracking-wider">Symbol</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g. SUSD"
                  required
                  className="input-field uppercase"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted uppercase tracking-wider">Decimals (Precision)</label>
              <input
                type="number"
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
                min={0}
                max={9}
                className="input-field"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !walletContext.connected}
            className="btn-primary mt-2 disabled:opacity-50 h-[50px] text-lg"
          >
            {loading ? "Broadcasting to Solana..." : walletContext.connected ? "Initialize Stablecoin" : "Connect Wallet to Proceed"}
          </button>
        </form>
      </div>
    </div>
  );
}
