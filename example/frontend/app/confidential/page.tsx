"use client";

import WalletButton from "@/components/WalletButton";

export default function ConfidentialPage() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Privileged <span className="solana-gradient">Privacy</span></h1>
        <WalletButton />
      </div>

      <p className="text-muted max-w-2xl">
        SSS-3 integrates the Token-2022 Confidential Transfer extension to encrypt balances and transfer amounts at the protocol level.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card flex flex-col gap-4 border-l-4 border-indigo-500">
          <h3 className="text-lg font-bold">Protocol Implementation</h3>
          <p className="text-sm text-muted leading-relaxed">
            Utilizes Twisted ElGamal encryption to maintain confidentiality for account balances and transfer quantities. 
            Auditor keys are established at stabilization to permit regulatory oversight where required.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 font-mono text-[10px] uppercase font-bold">
              ConfidentialTransferMint
            </span>
            <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 font-mono text-[10px] uppercase font-bold">
              ZK Proof Generation
            </span>
          </div>
        </div>

        <div className="glass-card flex flex-col gap-4 border-l-4 border-amber-500 bg-amber-500/5">
          <h3 className="text-lg font-bold text-amber-200">ZK-Proof Engine Required</h3>
          <p className="text-sm text-amber-100/70 leading-relaxed">
            Confidential operations require significant client-side computation for ElGamal key derivation and zero-knowledge proof generation.
          </p>
          <p className="text-xs text-amber-200 font-medium">
            → Use the SSS CLI or SDK for secure deposit, withdraw, and shielded transfers.
          </p>
        </div>

        <div className="glass-card md:col-span-2 space-y-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-bold">Standard Configuration (SSS-3)</h3>
            <p className="text-xs text-muted">Core extensions active for privacy-preserving stability.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {["ConfidentialTransferMint", "MetadataPointer", "PermanentDelegate", "Zero-Knowledge Stats"].map((ext) => (
              <div key={ext} className="p-3 rounded-lg bg-white/5 border border-border text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">{ext}</span>
                <p className="text-[10px] text-muted mt-1 uppercase">Active</p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-bold mb-4 uppercase tracking-tighter text-muted">Deployment Protocol</h4>
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</div>
                <div>
                  <p className="text-sm font-medium">Initialize SSS-3 Mint</p>
                  <code className="text-[11px] bg-black/40 px-2 py-1 rounded text-[#9945FF]">sss-token init --preset 3</code>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</div>
                <div>
                  <p className="text-sm font-medium">Configure Shielded Account</p>
                  <p className="text-xs text-muted">Derive ElGamal keys on a secure client environment.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</div>
                <div>
                  <p className="text-sm font-medium">Protocol Integration</p>
                  <p className="text-xs text-muted">Reference <code className="bg-white/5 px-1 rounded">docs/SSS-3.md</code> for advanced SDK patterns.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
