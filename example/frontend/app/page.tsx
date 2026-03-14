"use client";

import WalletButton from "@/components/WalletButton";

export default function Dashboard() {
  const cards = [
    {
      title: "Create Stablecoin",
      description: "Initialize a new SSS mint with custom parameters.",
      href: "/create",
    },
    {
      title: "Operations",
      description: "Mint, burn, freeze, and manage your stablecoin supply.",
      href: "/operations",
    },
    {
      title: "Roles",
      description: "Manage granular permissions for your stablecoin ecosystem.",
      href: "/roles",
    },
    {
      title: "Blacklist",
      description: "Enforce compliance via SSS-2 and SSS-4 blacklist features.",
      href: "/blacklist",
    },
    {
      title: "Confidential",
      description: "Explore privacy-preserving transfers with SSS-3.",
      href: "/confidential",
    },
    {
      title: "History",
      description: "Audit signatures and track transaction logs on-chain.",
      href: "/history",
    },
  ];

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tighter">
            Solana <span className="solana-gradient">Stablecoin Standard</span>
          </h1>
          <p className="text-muted text-lg max-w-xl">
            The enterprise-grade standard for programmable stablecoins on Solana. 
            Connect your wallet to manage your assets.
          </p>
        </div>
        <WalletButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <a key={card.href} href={card.href} className="glass-card flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">{card.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{card.description}</p>
            </div>
            <div className="mt-6 text-xs font-mono uppercase tracking-widest text-[#9945FF] group-hover:text-white transition-colors">
              Access Module →
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
