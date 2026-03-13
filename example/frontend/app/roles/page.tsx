"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";
import { parseProgramError } from "@/lib/errors";
import { SolanaStablecoin, Role, SSS_CORE_PROGRAM_ID, deriveConfigPda } from "@stbr/sss-token";
import { PublicKey } from "@solana/web3.js";
import type { Wallet } from "@coral-xyz/anchor";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const ROLES = [
  { label: "Admin", value: Role.Admin, key: "admin" },
  { label: "Minter", value: Role.Minter, key: "minter" },
  { label: "Freezer", value: Role.Freezer, key: "freezer" },
  { label: "Pauser", value: Role.Pauser, key: "pauser" },
  { label: "Burner", value: Role.Burner, key: "burner" },
  { label: "Blacklister", value: Role.Blacklister, key: "blacklister" },
  { label: "Seizer", value: Role.Seizer, key: "seizer" },
] as const;

const ROLE_NAMES: Record<number, string> = {
  [Role.Admin]: "admin",
  [Role.Minter]: "minter",
  [Role.Freezer]: "freezer",
  [Role.Pauser]: "pauser",
  [Role.Burner]: "burner",
  [Role.Blacklister]: "blacklister",
  [Role.Seizer]: "seizer",
};

type OpResult = { success: true; signature: string } | { success: false; error: string };

export default function RolesPage() {
  const { connection } = useConnection();
  const walletCtx = useWallet();
  const [result, setResult] = useState<OpResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [rolesList, setRolesList] = useState<{ address: string; role: string; pda: string }[] | null>(null);
  const [listMint, setListMint] = useState("");

  const getWallet = (): Wallet | null => {
    if (!walletCtx.publicKey || !walletCtx.signTransaction) return null;
    return {
      publicKey: walletCtx.publicKey,
      signTransaction: walletCtx.signTransaction,
      signAllTransactions: walletCtx.signAllTransactions!,
    } as Wallet;
  };

  const doGrant = async (mintAddr: string, address: string, roleValue: number) => {
    setLoading(true);
    setResult(null);
    try {
      const w = getWallet();
      if (!w) throw new Error("Connect your wallet first");
      const ssc = SolanaStablecoin.load(connection, w, new PublicKey(mintAddr));
      const sig = await ssc.roles.grant(w.publicKey, new PublicKey(address), roleValue);
      setResult({ success: true, signature: sig });
    } catch (err) {
      setResult({ success: false, error: parseProgramError(err instanceof Error ? err.message : String(err)) });
    } finally {
      setLoading(false);
    }
  };

  const doRevoke = async (mintAddr: string, address: string, roleValue: number) => {
    setLoading(true);
    setResult(null);
    try {
      const w = getWallet();
      if (!w) throw new Error("Connect your wallet first");
      const ssc = SolanaStablecoin.load(connection, w, new PublicKey(mintAddr));
      const sig = await ssc.roles.revoke(w.publicKey, new PublicKey(address), roleValue);
      setResult({ success: true, signature: sig });
    } catch (err) {
      setResult({ success: false, error: parseProgramError(err instanceof Error ? err.message : String(err)) });
    } finally {
      setLoading(false);
    }
  };

  const doList = async () => {
    if (!listMint.trim()) return;
    setLoading(true);
    setResult(null);
    setRolesList(null);
    try {
      // Use backend GET endpoint for listing (read-only, no signing needed)
      const res = await fetch(`${API_BASE}/roles/list/${listMint.trim()}`);
      const data = await res.json();
      if (data.roles) {
        setRolesList(data.roles);
      } else {
        setResult({ success: false, error: parseProgramError(data.error || "Failed to fetch roles") });
      }
    } catch {
      // Fallback: query on-chain directly
      try {
        const mintPk = new PublicKey(listMint.trim());
        const [configPda] = deriveConfigPda(mintPk);
        const accounts = await connection.getProgramAccounts(SSS_CORE_PROGRAM_ID, {
          filters: [
            { dataSize: 131 },
            { memcmp: { offset: 8, bytes: configPda.toBase58() } },
          ],
        });
        const roles: { address: string; role: string; pda: string }[] = [];
        for (const { pubkey, account } of accounts) {
          const data = account.data;
          if (data.length < 73) continue;
          const address = new PublicKey(data.slice(40, 72));
          const roleByte = data[72];
          const roleName = ROLE_NAMES[roleByte] ?? `unknown(${roleByte})`;
          roles.push({ address: address.toBase58(), role: roleName, pda: pubkey.toBase58() });
        }
        setRolesList(roles);
      } catch (err) {
        setResult({ success: false, error: parseProgramError(err instanceof Error ? err.message : String(err)) });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Access <span className="solana-gradient">Control</span></h1>
        <WalletButton />
      </div>
      
      <p className="text-muted max-w-2xl">
        Manage granular permissions for your stablecoin ecosystem. Grant and revoke administrative and operational roles using your connected wallet.
      </p>

      {!walletCtx.connected && (
        <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-300 text-sm">
          Connect your wallet (the mint authority) to grant or revoke roles.
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
        <div className="glass-card flex flex-col gap-4">
          <h3 className="text-lg font-bold">Grant Role</h3>
          <GrantRevokeForm
            action="grant"
            roles={ROLES}
            onSubmit={(mint, address, roleVal) => doGrant(mint, address, roleVal)}
            loading={loading}
            disabled={!walletCtx.connected}
          />
        </div>
        
        <div className="glass-card flex flex-col gap-4">
          <h3 className="text-lg font-bold">Revoke Role</h3>
          <GrantRevokeForm
            action="revoke"
            roles={ROLES}
            onSubmit={(mint, address, roleVal) => doRevoke(mint, address, roleVal)}
            loading={loading}
            disabled={!walletCtx.connected}
          />
        </div>

        <div className="glass-card md:col-span-2 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-bold">Audit Roles</h3>
            <p className="text-xs text-muted">Fetch all active roles for a specific stablecoin mint.</p>
          </div>
          
          <div className="flex gap-4">
            <input
              value={listMint}
              onChange={(e) => setListMint(e.target.value)}
              placeholder="Enter Mint Address"
              className="input-field max-w-md"
            />
            <button
              type="button"
              onClick={doList}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Fetching..." : "Fetch Registry"}
            </button>
          </div>

          {rolesList && (
            <div className="mt-4 border-t border-border pt-6">
              {rolesList.length === 0 ? (
                <p className="text-sm text-muted text-center py-8 bg-black/20 rounded-lg border border-dashed border-border">
                  No active roles found for this mint.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 uppercase text-xs font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Public Key</th>
                        <th className="px-6 py-3">Role Type</th>
                        <th className="px-6 py-3">PDA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rolesList.map((r, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs">{r.address}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded bg-[#9945FF]/20 text-[#9945FF] font-bold text-[10px] uppercase">
                              {r.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-muted">{r.pda}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
  disabled,
}: {
  action: string;
  roles: readonly { label: string; value: number; key: string }[];
  onSubmit: (mint: string, address: string, roleValue: number) => void;
  loading: boolean;
  disabled: boolean;
}) {
  const [mint, setMint] = useState("");
  const [address, setAddress] = useState("");
  const [roleIdx, setRoleIdx] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(mint, address, roles[roleIdx].value);
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
            placeholder="Wallet to grant/revoke"
            required
            className="input-field text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted uppercase tracking-wider">Role Type</label>
          <select
            value={roleIdx}
            onChange={(e) => setRoleIdx(parseInt(e.target.value, 10))}
            className="input-field text-sm appearance-none cursor-pointer"
          >
            {roles.map((r, i) => (
              <option key={r.key} value={i} className="bg-[#111]">
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || disabled}
        className="btn-primary mt-2 disabled:opacity-50"
      >
        {loading ? "Processing..." : action === "grant" ? "Confirm Grant" : "Confirm Revoke"}
      </button>
    </form>
  );
}
