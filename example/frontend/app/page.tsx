"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Dashboard() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>Solana Stablecoin Standard</h1>
        <WalletMultiButton />
      </div>
      <p style={{ color: "#666", maxWidth: "600px" }}>
        Create and manage SSS-1, SSS-2, and SSS-4 stablecoins. Connect your wallet to get started.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginTop: "2rem" }}>
        <a href="/create" style={{ padding: "1.5rem", border: "1px solid #ddd", borderRadius: "8px", textDecoration: "none", color: "inherit" }}>
          <strong>Create Stablecoin</strong>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#666" }}>Initialize a new SSS mint</p>
        </a>
        <a href="/operations" style={{ padding: "1.5rem", border: "1px solid #ddd", borderRadius: "8px", textDecoration: "none", color: "inherit" }}>
          <strong>Operations</strong>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#666" }}>Mint, burn, freeze, thaw</p>
        </a>
        <a href="/roles" style={{ padding: "1.5rem", border: "1px solid #ddd", borderRadius: "8px", textDecoration: "none", color: "inherit" }}>
          <strong>Roles</strong>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#666" }}>Grant and revoke roles</p>
        </a>
        <a href="/blacklist" style={{ padding: "1.5rem", border: "1px solid #ddd", borderRadius: "8px", textDecoration: "none", color: "inherit" }}>
          <strong>Blacklist</strong>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#666" }}>SSS-2/4 compliance</p>
        </a>
        <a href="/confidential" style={{ padding: "1.5rem", border: "1px solid #ddd", borderRadius: "8px", textDecoration: "none", color: "inherit" }}>
          <strong>Confidential</strong>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#666" }}>SSS-3 privacy-preserving transfers</p>
        </a>
      </div>
    </div>
  );
}
