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
import "./globals.css";

// Polyfill Buffer for Anchor and @solana/web3.js browser compatibility
import { Buffer } from "buffer";
import { usePathname } from "next/navigation";

if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const endpoint = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  const navItems = [
    { name: "Create", href: "/create" },
    { name: "Operations", href: "/operations" },
    { name: "Roles", href: "/roles" },
    { name: "Blacklist", href: "/blacklist" },
    { name: "Confidential", href: "/confidential" },
    { name: "History", href: "/history" },
  ];

  return (
    <html lang="en">
      <body>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <div className="min-h-screen flex flex-col bg-[#050505] text-white">
                <header className="px-8 py-4">
                  <nav className="flex gap-8 items-center max-w-7xl mx-auto w-full">
                    <a href="/" className="text-xl font-bold solana-gradient tracking-tighter">
                      SSS
                    </a>
                    <div className="flex gap-6 items-center flex-1">
                      {navItems.map((item) => (
                        <a
                          key={item.href}
                          href={item.href}
                          className={pathname === item.href ? "active" : ""}
                        >
                          {item.name}
                        </a>
                      ))}
                    </div>
                  </nav>
                </header>
                <main className="flex-1 max-w-7xl mx-auto w-full p-8">{children}</main>
              </div>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}
