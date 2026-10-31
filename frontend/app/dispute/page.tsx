"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, Clock, Gavel, AlertTriangle, RefreshCw } from "lucide-react"
import { useWeb3 } from "../web3-provider.tsx"
import { RETROFUNDING_ABI, CONTRACT_ADDRESSES, DISTRIBUTION_STATUS } from "../contracts.ts"

const DIST_ID = "0xdevcon8-retro-funding-001"

export default function DisputePage() {
  const { provider, signer, isConnected, connect, account } = useWeb3()
  const [status, setStatus] = useState<{ status: string; deadline: string; open: boolean; evidence: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!provider) return
    setLoading(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.RetroFunding || "0x0", RETROFUNDING_ABI, provider)
      Promise.all([
        contract.getStatus(DIST_ID),
        contract.getDisputeDeadline(DIST_ID),
        contract.isDisputeOpen(DIST_ID),
        contract.getDisputeEvidence(DIST_ID),
      ]).then(([s, d, o, e]) => {
        setStatus({
          status: DISTRIBUTION_STATUS[Number(s)] || "UNKNOWN",
          deadline: new Date(Number(d) * 1000).toLocaleString(),
          open: o,
          evidence: e,
        })
      }).catch(() => {
        setStatus({ status: "FINALIZED", deadline: "N/A", open: false, evidence: "0x0" })
      }).finally(() => setLoading(false))
    } catch {
      setLoading(false)
    }
  }, [provider])

  const handleSubmitDispute = async () => {
    if (!signer || !isConnected) { connect(); return }
    setSubmitting(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.RetroFunding || "0x0", RETROFUNDING_ABI, signer)
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("Dispute: allocation appears inconsistent with jury weights"))
      await contract.submitDispute(DIST_ID, ethers.parseEther("0.1"), evidenceHash)
      alert("Dispute submitted successfully")
    } catch (e: any) {
      alert("Failed to submit dispute: " + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!status) return (
    <div className="container-custom py-10">
      <div className="card flex items-center justify-center h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-charcoal-light/10 flex items-center justify-center text-charcoal-light">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-charcoal-light">Loading dispute status...</p>
        </div>
      </div>
    </div>
  )

  const isFinalized = status.status === "FINALIZED"
  const isDisputed = status.status === "DISPUTED"

  return (
    <div className="container-custom py-10">
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="flex-grow">
          <h1 className="font-serif font-bold text-3xl text-charcoal mb-2">Dispute Center</h1>
          <p className="text-charcoal-light">Challenge a proposed distribution before it is finalized. Disputes require evidence and a bond.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <div className="card mb-8">
            <div className="p-6 border-b border-charcoal-light/20">
              <div className="flex items-center gap-3 mb-4">
                <Gavel className="w-5 h-5 text-charcoal" />
                <h3 className="font-serif font-bold text-lg text-charcoal">Proposed Distribution</h3>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <div className="text-xs text-charcoal-light uppercase tracking-wider">Distribution ID</div>
                  <div className="font-mono text-xs text-charcoal break-all">{DIST_ID}</div>
                </div>
                <div>
                  <div className="text-xs text-charcoal-light uppercase tracking-wider">Status</div>
                  <div className={`font-bold text-sm ${isFinalized ? "text-emerald" : isDisputed ? "text-forest" : "text-charcoal"}`}>
                    {status.status}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-charcoal-light uppercase tracking-wider">Dispute Window</div>
                  <div className="font-mono text-xs text-charcoal">{status.deadline}</div>
                </div>
                <div>
                  <div className="text-xs text-charcoal-light uppercase tracking-wider">Open Dispute</div>
                  <div className={`font-bold text-sm ${status.open ? "text-red-600" : "text-emerald"}`}>
                    {status.open ? "Yes" : "No"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-charcoal-light uppercase tracking-wider">Evidence Hash</div>
                  <div className="font-mono text-xs text-charcoal break-all">{status.evidence}</div>
                </div>
                <div>
                  <div className="text-xs text-charcoal-light uppercase tracking-wider">Finalizable</div>
                  <div className={`font-bold text-sm ${isFinalized ? "text-red-600" : "text-charcoal-light"}`}>
                    {isFinalized ? "No (immutable)" : "Yes (after window)"}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <h4 className="font-bold text-charcoal mb-4">How Disputes Work</h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-forest text-white flex items-center justify-center text-xs font-bold">1</div>
                  <div>
                    <div className="font-medium text-charcoal">Submit during window</div>
                    <div className="text-xs text-charcoal-light">Anyone can submit a dispute before the deadline with a bond and evidence hash.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-forest text-white flex items-center justify-center text-xs font-bold">2</div>
                  <div>
                    <div className="font-medium text-charcoal">Resolver adjudicates</div>
                    <div className="text-xs text-charcoal-light">A dispute resolver reviews evidence and rules valid or invalid.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-forest text-white flex items-center justify-center text-xs font-bold">3</div>
                  <div>
                    <div className="font-medium text-charcoal">Valid dispute → invalidated</div>
                    <div className="text-xs text-charcoal-light">The proposed result is invalidated and must be re-proposed with a new dispute window.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-forest text-white flex items-center justify-center text-xs font-bold">4</div>
                  <div>
                    <div className="font-medium text-charcoal">Invalid dispute → bond slashed</div>
                    <div className="text-xs text-charcoal-light">Invalid disputes lose their bond and the distribution returns to proposed.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="card h-[500px]">
            <div className="p-6">
              <h3 className="font-serif font-bold text-lg text-charcoal mb-6">Submit a Dispute</h3>
              {isFinalized ? (
                <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-bold text-red-800">Distribution Finalized</span>
                  </div>
                  <p className="text-xs text-red-700">This distribution has been finalized and is immutable. Disputes are no longer accepted.</p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-charcoal mb-2">Bond (ETH)</label>
                    <input
                      type="number"
          step="0.01"
          defaultValue="0.1"
          className="w-full p-3 border border-charcoal-light/20 rounded-lg bg-white focus:ring-2 focus:ring-forest focus:border-transparent outline-none"
        />
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-charcoal mb-2">Evidence Description</label>
                    <textarea
            defaultValue="Dispute: allocation appears inconsistent with jury pairwise judgments"
            rows={4}
            className="w-full p-3 border border-charcoal-light/20 rounded-lg bg-white focus:ring-2 focus:ring-forest focus:border-transparent outline-none"
          />
                  </div>
                  <button
            onClick={handleSubmitDispute}
            disabled={submitting || !isConnected}
            className={
              isConnected
                ? "w-full py-3 rounded-lg font-medium transition-colors bg-forest text-white hover:bg-[#143524]"
                : "w-full py-3 rounded-lg font-medium transition-colors bg-charcoal-light/50 text-charcoal-light cursor-not-allowed"
            }
          >
            {submitting ? "Submitting..." : isConnected ? "Submit Dispute" : "Connect Wallet"}
                  </button>
                  {!isConnected && (
                    <p className="mt-3 text-xs text-charcoal-light">Connect your wallet to submit a dispute.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
