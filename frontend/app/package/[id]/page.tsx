export default function PackagePage() {
  return (
    <div className="container-custom py-10">
      <div className="flex items-center gap-2 mb-8">
        <a href="/distribution" className="text-charcoal-light hover:text-forest text-sm">
          ← Back to Distribution
        </a>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Package identity */}
        <div className="lg:col-span-1">
          <div className="card h-fit sticky top-24">
            <div className="p-6">
              <div className="w-16 h-16 rounded-full bg-forest flex items-center justify-center text-white font-bold text-xl mb-4">
                QR
              </div>
              <h2 className="font-serif font-bold text-xl text-charcoal mb-2">QR Ticketing Library</h2>
              <div className="font-mono text-xs text-charcoal-light mb-4">0x102</div>
              <div className="p-3 bg-charcoal/5 rounded border border-charcoal-light/20 mb-4">
                <div className="text-xs text-charcoal-light uppercase tracking-wider mb-1">Level 1</div>
                <div className="font-bold text-charcoal">Direct dependency of Event App</div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-charcoal-light">Weight</span>
                  <span className="font-mono text-charcoal">111,126,784,658,465,067 / 1e18</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-charcoal-light">Retention Rate</span>
                  <span className="font-mono text-charcoal">50%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Payout explanation */}
        <div className="lg:col-span-2">
          <div className="card h-[700px] flex flex-col">
            <div className="p-6 border-b border-charcoal-light/20">
              <h1 className="font-serif font-bold text-2xl text-charcoal">Why did I receive this amount?</h1>
              <p className="text-charcoal-light mt-1">Complete breakdown of your package's allocation calculation.</p>
            </div>
            <div className="p-6 flex-grow overflow-y-auto space-y-6">
              {/* Step 1: Jury weight */}
              <div className="border-l-4 border-forest pl-4 py-3 bg-forest/5">
                <h3 className="font-bold text-charcoal mb-2">1. Jury Importance Weight</h3>
                <p className="text-sm text-charcoal-light mb-3">
                  Your weight was calculated from pairwise jury judgments using fixed-point power iteration.
                  3 jurors compared you against other packages.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-2">
                    <span className="text-charcoal-light">Juror Alpha:</span>
                    <span className="font-mono text-xs text-forest">QR Ticketing {'>'} Hindi i18n ✓</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-2">
                    <span className="text-charcoal-light">Juror Alpha:</span>
                    <span className="font-mono text-xs text-forest">QR Ticketing {'>'} Wallet Connection ✓</span>
                  </div>
                  <div className="flex justify-between text-sm pb-2">
                    <span className="text-charcoal-light">Juror Beta:</span>
                    <span className="font-mono text-xs text-forest">QR Ticketing {'>'} Hindi i18n ✓</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-charcoal-light/20 flex justify-between text-sm">
                  <span className="text-charcoal-light">Calculated Weight</span>
                  <span className="font-mono text-bold text-charcoal">0.1111 (11.11%)</span>
                </div>
              </div>

              {/* Step 2: Incoming funding */}
              <div className="border-l-4 border-emerald pl-4 py-3 bg-emerald/5">
                <h3 className="font-bold text-charcoal mb-2">2. Incoming Funding</h3>
                <p className="text-sm text-charcoal-light mb-3">
                  You received base allocation from the pot (by weight) plus redistributions from upstream packages.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-2">
                    <span className="text-charcoal-light">Base from pot (by weight)</span>
                    <span className="font-mono text-xs text-charcoal">11,112,678,465,846,507 wei</span>
                  </div>
                  <div className="flex justify-between text-sm pb-2">
                    <span className="text-charcoal-light">From Devcon Event App</span>
                    <span className="font-mono text-xs text-charcoal">1,590,555,123,928,411 wei</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-charcoal-light/20 flex justify-between font-bold text-sm">
                  <span className="text-charcoal-light">Total Received</span>
                  <span className="font-mono text-charcoal">12,703,233,589,774,918 wei</span>
                </div>
              </div>

              {/* Step 3: Retention */}
              <div className="border-l-4 border-charcoal pl-4 py-3 bg-charcoal/5">
                <h3 className="font-bold text-charcoal mb-2">3. Retention Calculation</h3>
                <p className="text-sm text-charcoal-light mb-3">
                  You retain 50% of all funding you receive. The remainder is redistributed to your dependencies.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-2">
                    <span className="text-charcoal-light">Total Received</span>
                    <span className="font-mono text-xs text-charcoal">12,703,233,589,774,918 wei</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-2">
                    <span className="text-charcoal-light">× Retention Rate</span>
                    <span className="font-mono text-xs text-charcoal">50%</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-charcoal-light/20 flex justify-between font-bold text-sm">
                    <span className="text-charcoal-light">Amount Retained</span>
                    <span className="font-mono text-charcoal">6,351,616,794,887,459 wei</span>
                  </div>
                </div>
              </div>

              {/* Step 4: Redistribution */}
              <div className="border-l-4 border-[#2563eb] pl-4 py-3 bg-blue/5">
                <h3 className="font-bold text-charcoal mb-2">4. Redistribution to Dependencies</h3>
                <p className="text-sm text-charcoal-light mb-3">
                  The remaining 50% is split proportionally among your dependencies by their weights.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-2">
                    <span className="text-charcoal-light">Amount to Redistribute</span>
                    <span className="font-mono text-xs text-charcoal">6,351,616,794,887,459 wei</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-2">
                    <span className="text-charcoal-light">→ Cryptographic Utility</span>
                    <span className="font-mono text-xs text-charcoal">3,175,808,397,443,730 wei</span>
                  </div>
                  <div className="flex justify-between text-sm pb-2">
                    <span className="text-charcoal-light">→ Encoding Library</span>
                    <span className="font-mono text-xs text-charcoal">3,175,808,397,443,729 wei</span>
                  </div>
                </div>
              </div>

              {/* Step 5: Final */}
              <div className="bg-white border-2 border-forest rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-forest text-lg">Final Allocation</h3>
                  <span className="badge badge-forest">Verified on-chain</span>
                </div>
                <div className="text-2xl font-bold text-charcoal font-mono mt-2">
                  6,351,616,794,887,459 wei
                </div>
                <p className="text-xs text-charcoal-light mt-2">
                  = Amount Retained (your final payout; no further upstream inflows in this round)
                </p>
              </div>

              {/* Merkle proof */}
              <div className="border border-charcoal-light/20 rounded-lg p-4">
                <h3 className="font-bold text-charcoal mb-3">5. Merkle Inclusion Proof</h3>
                <p className="text-xs text-charcoal-light mb-3">
                  Your allocation is committed in the Merkle root. You can claim with a cryptographic proof.
                </p>
                <div className="space-y-2 text-xs font-mono text-charcoal-light">
                  <div>Leaf: keccak256(recipient + allocation + index)</div>
                  <div className="text-charcoal font-mono">0xabcd…1234</div>
                  <div>Root: 0x3d94…56ef1</div>
                  <div className="text-emerald font-medium">✓ Proof valid against committed root</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Claim action */}
        <div className="lg:col-span-1">
          <div className="card sticky top-24">
            <div className="p-6">
              <h3 className="font-serif font-bold text-lg text-charcoal mb-4">Claim Your Funds</h3>
              <div className="p-4 bg-emerald/10 rounded-lg border border-emerald/20 mb-6">
                <div className="text-xs text-emerald uppercase tracking-wider font-medium mb-2">Final Payout</div>
                <div className="font-bold text-emerald font-mono text-lg">6,351,616,794,887,459 wei</div>
              </div>
              <button className="w-full btn-emerald mb-4">
                Claim Allocation
              </button>
              <p className="text-xs text-charcoal-light text-center">
                Requires connected wallet on Sepolia. Transaction verified on Etherscan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
