"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const endpoint = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
                <header style={{ padding: "1rem 2rem", borderBottom: "1px solid #eee" }}>
                  <nav style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                    <a href="/" style={{ fontWeight: 600, textDecoration: "none", color: "#333" }}>
                      SSS Dashboard
                    </a>
                    <a href="/create" style={{ textDecoration: "none", color: "#666" }}>
                      Create
                    </a>
                    <a href="/operations" style={{ textDecoration: "none", color: "#666" }}>
                      Operations
                    </a>
                    <a href="/roles" style={{ textDecoration: "none", color: "#666" }}>
                      Roles
                    </a>
                    <a href="/blacklist" style={{ textDecoration: "none", color: "#666" }}>
                      Blacklist
                    </a>
                    <a href="/history" style={{ textDecoration: "none", color: "#666" }}>
                      History
                    </a>
                  </nav>
                </header>
                <main style={{ flex: 1, padding: "2rem" }}>{children}</main>
              </div>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}
