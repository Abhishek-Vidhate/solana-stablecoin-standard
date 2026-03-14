"use client";

import dynamic from "next/dynamic";
import React from "react";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function WalletButton() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-10 w-32 bg-white/5 animate-pulse rounded-md" />
    );
  }

  return <WalletMultiButtonDynamic />;
}
