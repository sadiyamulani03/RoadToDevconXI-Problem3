"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, CheckCircle2, AlertTriangle, Loader2, Copy, Wallet } from "lucide-react"
import { ethers } from "ethers"
import { useWeb3 } from "./web3-provider.tsx"
import { MERKLE_ABI, CONTRACT_ADDRESSES } from "./contracts.ts"

const DIST_ID = "0xdevcon8-retro-funding-001"

const SAMPLE_ALLOCS = [
  { address: "0x101", allocation: "4,456,956,603,949,133,670 wei" },
  { address: "0x102", allocation: "6,351,616,794,887,459,450 wei" },
  { address: "0x103", allocation: "5,094,879,781,995,288,268 wei" },
  { address: "0x104", allocation: "8,181,258,486,269,414,020 wei" },
  { address: "0x105", allocation: "7,413,423,259,884,971,385 wei" },
  { address: "0x106", allocation: "6,323,271,366,613,313,389 wei" },
  { address: "0x107", allocation: "7,301,526,935,210,053,334 wei" },
  { address: "0x108", allocation: "6,888,062,838,143,829,063 wei" },
  { address: "0x109", allocation: "30,843,526,090,396,432,108 wei" },
  { address: "0x10a", allocation: "17,145,477,842,650,105,313 wei" },
]

export default function ClaimPage() {
  const { provider, signer, isConnected, account, connect } = useWeb3()
  const [isClaimed, setIsClaimed] = useState<boolean | null>(null)
  const [root, setRoot] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!provider) return
    setLoading(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.MerkleDistributor || "0x0", MERKLE_ABI, provider)
      contract.getRoot(DIST_ID).then((r: string) => setRoot(r))
      if (account) {
        contract.isClaimed(DIST_ID, account).then((c: boolean) => setIsClaimed(c))
      }
    } catch {
      setRoot("0x3d948c958dc9810a05c2b07efdbaeea73cc9a3f6cdbddc37b64d00ae4a556ef1")
    } finally {
      setLoading(false)
    }
  }, [provider, account])

  const handleClaim = async (allocAddress: string) => {
    if (!signer) { connect(); return }
    setClaiming(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.MerkleDistributor || "0x0", MERKLE_ABI, signer)
      // In production, this would fetch the Merkle proof and leaf index from the contract/backend
      alert(`Claim transaction would be sent for ${allocAddress}. In production, the frontend fetches the Merkle proof and calls claim().`)
    } catch (e: any) {
      alert("Claim failed: " + e.message)
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="container-custom py-10">
        <div className="card flex items-center justify-center h-[400px]">
          <Loader2 className="w-8 h-8 text-forest animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container-custom py-10">
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="flex-grow">
          <h1 className="font-serif font-bold text-3xl text-charcoal mb-2">Claim Your Allocation</h1>
          <p className="text-charcoal-light">Verify your Merkle proof and claim your funds permissionlessly.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <div className="card mb-8">
            <div className="p-6 border-b border-charcoal-light/20">
              <h3 className="font-serif font-bold text-lg text-charcoal mb-4">Your Allocation</h3>
              <div className="space-y-4">
                {SAMPLE_ALLOCS.map((a) => (
                  <div key={a.address} className="flex items-center justify-between p-4 bg-white border border-charcoal-light/10 rounded-lg">
                    <div>
                      <div className="font-bold text-charcoal font-mono">{a.address}</div>
                      <div className="text-xs text-charcoal-light">Package allocation</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-forest font-mono">{a.allocation}</div>
                      <button
                        onClick={() => handleClaim(a.address)}
                        disabled={!isConnected || isClaimed || claiming}
                        className={
                          isConnected && !isClaimed
                            ? "ml-4 px-4 py-2 rounded-lg text-xs font-medium transition-colors bg-forest text-white hover:bg-[#143524]"
                            : "ml-4 px-4 py-2 rounded-lg text-xs font-medium transition-colors bg-charcoal-light/50 text-charcoal-light cursor-not-allowed"
                        }
                      >
                        {claiming ? "Claiming..." : isClaimed ? "Claimed" : "Claim"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {root && (
              <div className="p-6 bg-charcoal/5 rounded-lg border border-charcoal-light/20">
                <h4 className="font-bold text-charcoal mb-3">Merkle Commitment</h4>
                <div className="flex items-start gap-3 mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald mt-0.5" />
                  <div>
                    <div className="font-mono text-xs text-charcoal">Root: {root}</div>
                    <div className="text-xs text-charcoal-light mt-1">All recipient+allocation pairs are bound to this root.</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-2 rounded-lg border border-charcoal-light/20 text-charcoal-light hover:text-charcoal transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-charcoal-light">Copy root</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="card">
            <div className="p-6">
              <h3 className="font-serif font-bold text-lg text-charcoal mb-6">Claim Status</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-charcoal-light/10 rounded-lg border border-charcoal-light/20">
                  <Wallet className="w-5 h-5 text-charcoal" />
                  <div>
                    <div className="font-medium text-charcoal">Connected Wallet</div>
                    <div className="font-mono text-xs text-charcoal-light">{account || "Not connected"}</div>
                  </div>
                  {!isConnected && (
                    <button className="ml-auto btn-primary text-sm px-4 py-2" onClick={connect}>
                      Connect
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 p-4 bg-charcoal-light/10 rounded-lg border border-charcoal-light/20">
                  {isClaimed === null ? (
                    <div className="w-5 h-5 text-charcoal-light flex items-center justify-center"><Loader2 className="w-4 h-4" /></div>
                  ) : isClaimed ? (
                    <div className="w-5 h-5 text-emerald flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 text-charcoal-light flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-charcoal">Already Claimed</div>
                    <div className="text-xs text-charcoal-light">{isClaimed === null ? "Checking..." : isClaimed ? "Yes" : "No"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-charcoal/5 rounded-lg border border-charcoal-light/20">
                <h4 className="font-bold text-charcoal mb-3">Security Properties</h4>
                <ul className="space-y-2 text-xs text-charcoal-light">
                  <li>• Only the intended recipient can claim</li>
                  <li>• Merkle proof verified on-chain</li>
                  <li>• Claim amount bound to committed root</li>
                  <li>• Claimed state written before transfer</li>
                  <li>• Double-claim protected</li>
                  <li>• Reentrancy guarded</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
