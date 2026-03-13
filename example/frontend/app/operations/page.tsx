"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";
import { parseProgramError } from "@/lib/errors";
import { SolanaStablecoin } from "@stbr/sss-token";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { Wallet } from "@coral-xyz/anchor";

type OpResult = { success: true; signature: string } | { success: false; error: string };

export default function OperationsPage() {
  const { connection } = useConnection();
  const walletCtx = useWallet();
  const [result, setResult] = useState<OpResult | null>(null);
  const [loading, setLoading] = useState(false);

  const getWallet = (): Wallet | null => {
    if (!walletCtx.publicKey || !walletCtx.signTransaction) return null;
    return {
      publicKey: walletCtx.publicKey,
      signTransaction: walletCtx.signTransaction,
      signAllTransactions: walletCtx.signAllTransactions!,
    } as Wallet;
  };

  const doOp = async (fn: (ssc: SolanaStablecoin, wallet: Wallet) => Promise<string>, mintAddr: string) => {
    setLoading(true);
    setResult(null);
    try {
      const w = getWallet();
      if (!w) throw new Error("Connect your wallet first");
      const ssc = SolanaStablecoin.load(connection, w, new PublicKey(mintAddr));
      const sig = await fn(ssc, w);
      setResult({ success: true, signature: sig });
    } catch (err) {
      setResult({ success: false, error: parseProgramError(err instanceof Error ? err.message : String(err)) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Token <span className="solana-gradient">Operations</span></h1>
        <WalletButton />
      </div>
      
      <p className="text-muted max-w-2xl">
        Manage your stablecoin supply and governance. Mint, burn, freeze, thaw, pause, and seize tokens directly from your connected wallet.
      </p>

      {!walletCtx.connected && (
        <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-300 text-sm">
          Connect your wallet to use operations. Your wallet must have the required roles granted for the target mint.
        </div>
      )}

      {result && (
        <div
          className={`p-4 rounded-xl border ${
            result.success 
              ? "bg-green-500/10 border-green-500/50 text-green-400" 
              : "bg-red-500/10 border-red-500/50 text-red-400"
          }`}
        >
          {result.success ? (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-sm uppercase tracking-wider">Success</span>
              <span className="font-mono text-xs break-all">{result.signature}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-sm uppercase tracking-wider">Error</span>
              <span className="text-sm">{result.error}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
        <OpForm
          title="Mint Tokens"
          fields={[
            { name: "mint", label: "Mint Address", placeholder: "Base58 address of the stablecoin" },
            { name: "recipient", label: "Recipient Address", placeholder: "Wallet to receive tokens" },
            { name: "amount", label: "Amount (Raw Units)", placeholder: "e.g. 1000000" },
          ]}
          onSubmit={(f) => doOp(
            (ssc, w) => ssc.mintTokens({ minter: w.publicKey, recipient: new PublicKey(f.recipient), amount: new BN(f.amount) }),
            f.mint
          )}
          loading={loading}
          disabled={!walletCtx.connected}
        />
        <OpForm
          title="Burn Tokens"
          fields={[
            { name: "mint", label: "Mint Address", placeholder: "Base58 address" },
            { name: "from", label: "Source Account Owner", placeholder: "Owner of the tokens to burn" },
            { name: "amount", label: "Amount (Raw Units)", placeholder: "e.g. 1000000" },
          ]}
          onSubmit={(f) => doOp(
            (ssc, w) => ssc.burnTokens({ burner: w.publicKey, from: new PublicKey(f.from), amount: new BN(f.amount) }),
            f.mint
          )}
          loading={loading}
          disabled={!walletCtx.connected}
        />
        <OpForm
          title="Freeze Account"
          fields={[
            { name: "mint", label: "Mint Address", placeholder: "Base58 address" },
            { name: "account", label: "Token Account", placeholder: "ATA to freeze" },
          ]}
          onSubmit={(f) => doOp(
            (ssc, w) => ssc.freezeAccount(w.publicKey, new PublicKey(f.account)),
            f.mint
          )}
          loading={loading}
          disabled={!walletCtx.connected}
        />
        <OpForm
          title="Thaw Account"
          fields={[
            { name: "mint", label: "Mint Address", placeholder: "Base58 address" },
            { name: "account", label: "Token Account", placeholder: "ATA to thaw" },
          ]}
          onSubmit={(f) => doOp(
            (ssc, w) => ssc.thawAccount(w.publicKey, new PublicKey(f.account)),
            f.mint
          )}
          loading={loading}
          disabled={!walletCtx.connected}
        />
        <OpForm
          title="Global Pause"
          fields={[{ name: "mint", label: "Mint Address", placeholder: "Base58 address" }]}
          onSubmit={(f) => doOp(
            (ssc, w) => ssc.pause(w.publicKey),
            f.mint
          )}
          loading={loading}
          disabled={!walletCtx.connected}
        />
        <OpForm
          title="Global Unpause"
          fields={[{ name: "mint", label: "Mint Address", placeholder: "Base58 address" }]}
          onSubmit={(f) => doOp(
            (ssc, w) => ssc.unpause(w.publicKey),
            f.mint
          )}
          loading={loading}
          disabled={!walletCtx.connected}
        />
        <OpForm
          title="Seize/Clawback"
          fields={[
            { name: "mint", label: "Mint Address", placeholder: "Base58 address" },
            { name: "from", label: "Source Account", placeholder: "Account to seize from" },
            { name: "to", label: "Destination Account", placeholder: "Account to send to" },
            { name: "amount", label: "Amount (Raw Units)", placeholder: "e.g. 1000000" },
          ]}
          onSubmit={(f) => doOp(
            (ssc, w) => ssc.seize({ seizer: w.publicKey, from: new PublicKey(f.from), to: new PublicKey(f.to), amount: new BN(f.amount) }),
            f.mint
          )}
          loading={loading}
          disabled={!walletCtx.connected}
        />
        <OpForm
          title="Update Fees (SSS-4)"
          fields={[
            { name: "mint", label: "Mint Address", placeholder: "Base58 address" },
            { name: "basisPoints", label: "Fee (BPS)", placeholder: "0-10000" },
            { name: "maximumFee", label: "Cap (Raw Units)", placeholder: "e.g. 1000000" },
          ]}
          onSubmit={(f) => doOp(
            (ssc, w) => ssc.fees.updateFee(w.publicKey, parseInt(f.basisPoints, 10), new BN(f.maximumFee)),
            f.mint
          )}
          loading={loading}
          disabled={!walletCtx.connected}
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
  disabled,
}: {
  title: string;
  fields: { name: string; label: string; placeholder: string }[];
  onSubmit: (values: Record<string, string>) => void;
  loading: boolean;
  disabled: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card flex flex-col gap-4"
    >
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="space-y-3">
        {fields.map(({ name, label, placeholder }) => (
          <div key={name} className="space-y-1">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">
              {label}
            </label>
            <input
              name={name}
              value={values[name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
              placeholder={placeholder}
              required
              className="input-field text-sm"
            />
          </div>
        ))}
      </div>
      <button
        type="submit"
        disabled={loading || disabled}
        className="btn-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Processing..." : `Execute ${title.split(' ')[0]}`}
      </button>
    </form>
  );
}
