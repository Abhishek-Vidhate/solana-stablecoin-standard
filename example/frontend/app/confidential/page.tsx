"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function ConfidentialPage() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>Confidential Transfers (SSS-3)</h1>
        <WalletMultiButton />
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #e0e7ff", borderRadius: "8px", marginBottom: "1.5rem", background: "#f5f3ff" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>SSS-3 Privacy Preset</h3>
        <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
          Uses Token-2022 Confidential Transfer extension to encrypt balances and transfer amounts on-chain.
          Only the account owner and designated auditor can decrypt values.
        </p>
      </div>

      <div style={{ padding: "1rem", border: "1px solid #fef3c7", borderRadius: "8px", marginBottom: "1.5rem", background: "#fffbeb" }}>
        <p style={{ margin: 0, color: "#92400e", fontWeight: 600, fontSize: "0.9rem" }}>
          Client-side operations require ZK proof generation
        </p>
        <p style={{ margin: "0.5rem 0 0", color: "#666", fontSize: "0.85rem" }}>
          Confidential transfers need client-side ElGamal key derivation and zero-knowledge proof generation.
          Use the SSS CLI or SDK for deposit, withdraw, and confidential transfers.
        </p>
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Extension Status (SSS-3)</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", background: "#dcfce7", color: "#166534" }}>
            ConfidentialTransferMint
          </span>
          <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", background: "#dcfce7", color: "#166534" }}>
            MetadataPointer
          </span>
          <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", background: "#dcfce7", color: "#166534" }}>
            PermanentDelegate
          </span>
          <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", background: "#e5e7eb", color: "#6b7280" }}>
            TransferHook (SSS-3: off)
          </span>
        </div>
        <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
          Auditor key is set by issuer at mint creation. Use <code style={{ background: "#f3f4f6", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>sss-token confidential</code> commands or the SDK for operations.
        </p>
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #ddd", borderRadius: "8px" }}>
        <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>How to use SSS-3</h3>
        <ol style={{ margin: 0, paddingLeft: "1.25rem", color: "#666", fontSize: "0.9rem", lineHeight: 1.8 }}>
          <li>Create an SSS-3 mint via CLI: <code style={{ background: "#f3f4f6", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>sss-token init --preset 3</code></li>
          <li>Configure account, deposit, and transfer via SDK or CLI</li>
          <li>See <code style={{ background: "#f3f4f6", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>docs/SSS-3.md</code> for full documentation</li>
        </ol>
      </div>
    </div>
  );
}
