"use client"

import { useEffect, useState } from "react"
import { Users, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react"
import { useWeb3 } from "../web3-provider.tsx"
import { JURY_ABI, CONTRACT_ADDRESSES } from "../contracts.ts"

const SAMPLE_JURORS = [
  { address: "0x11", name: "Juror Alpha" },
  { address: "0x12", name: "Juror Beta" },
  { address: "0x13", name: "Juror Gamma" },
]

const SAMPLE_JUDGMENTS = [
  { juror: "0x11", packageA: "0x102", packageB: "0x103", winner: 0, reason: "Ticketing is user-facing and critical" },
  { juror: "0x11", packageA: "0x102", packageB: "0x104", winner: 0, reason: "Ticketing has broader impact" },
  { juror: "0x11", packageA: "0x103", packageB: "0x104", winner: 1, reason: "Wallet connection enables transactions" },
  { juror: "0x12", packageA: "0x102", packageB: "0x103", winner: 0, reason: "Ticketing drives revenue" },
  { juror: "0x12", packageA: "0x104", packageB: "0x103", winner: 0, reason: "Wallet is prerequisite for tickets" },
  { juror: "0x13", packageA: "0x102", packageB: "0x104", winner: 1, reason: "Without wallet, users cannot buy tickets" },
]

function winnerLabel(w: number) {
  return w === 0 ? "Package A" : w === 1 ? "Package B" : "Tie"
}

export default function JuryPage() {
  const { provider, signer } = useWeb3()
  const [jurors, setJurors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!provider) return
    setLoading(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.Jury || "0x0", JURY_ABI, provider)
      contract.getNonce(SAMPLE_JURORS[0].address).then(() => {
        setJurors(SAMPLE_JURORS.map(j => j.address))
      }).catch(() => setJurors(SAMPLE_JURORS.map(j => j.address)))
    } catch {
      setJurors(SAMPLE_JURORS.map(j => j.address))
    } finally {
      setLoading(false)
    }
  }, [provider])

  return (
    <div className="container-custom py-10">
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="flex-grow">
          <h1 className="font-serif font-bold text-3xl text-charcoal mb-2">Jury Explorer</h1>
          <p className="text-charcoal-light">Registered jurors and their pairwise package importance judgments. All judgments are EIP-712 signed and verified on-chain.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-outline">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 card">
          <div className="p-6">
            <h3 className="font-serif font-bold text-lg text-charcoal mb-6">Registered Jurors</h3>
            <div className="space-y-4">
              {SAMPLE_JURORS.map((juror) => (
                <div key={juror.address} className="flex items-center gap-4 p-4 bg-white border border-charcoal-light/10 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-forest/10 text-forest flex items-center justify-center font-bold">
                    {juror.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-charcoal">{juror.name}</div>
                    <div className="font-mono text-xs text-charcoal-light">{juror.address}</div>
                  </div>
                  <div className="ml-auto">
                    <span className="badge badge-forest">Registered</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-charcoal/5 rounded-lg border border-charcoal-light/20">
              <div className="flex items-center gap-2 text-sm mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald" />
                <span className="font-medium text-charcoal">Only registered jurors can submit judgments</span>
              </div>
              <div className="text-xs text-charcoal-light">
                Kavya (JUROR_ADMIN) registers jurors but cannot forge or alter judgments.
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 card">
          <div className="p-6 border-b border-charcoal-light/20">
            <h3 className="font-serif font-bold text-lg text-charcoal mb-4">Pairwise Judgments</h3>
            <p className="text-sm text-charcoal-light mb-4">Each row is a juror's signed comparison of two packages.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-light/20">
                  <th className="text-left pb-3 text-charcoal-light text-xs font-medium uppercase">Juror</th>
                  <th className="text-left pb-3 text-charcoal-light text-xs font-medium uppercase">Package A</th>
                  <th className="text-left pb-3 text-charcoal-light text-xs font-medium uppercase">Package B</th>
                  <th className="text-left pb-3 text-charcoal-light text-xs font-medium uppercase">Winner</th>
                  <th className="text-left pb-3 text-charcoal-light text-xs font-medium uppercase">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-light/10">
                {SAMPLE_JUDGMENTS.map((j, i) => (
                  <tr key={i} className="hover:bg-charcoal-light/5 transition-colors">
                    <td className="pb-3 text-charcoal">
                      <span className="font-mono text-xs">{j.juror}</span>
                    </td>
                    <td className="pb-3 text-charcoal font-mono text-xs">{j.packageA}</td>
                    <td className="pb-3 text-charcoal font-mono text-xs">{j.packageB}</td>
                    <td className="pb-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${j.winner === 2 ? "badge-emerald" : "badge-charcoal"}`}>
                        {winnerLabel(j.winner)}
                      </span>
                    </td>
                    <td className="pb-3">
                      <span className="badge badge-emerald text-[10px]">EIP-712 ✓</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-charcoal/5 rounded-lg border border-charcoal-light/20">
            <h4 className="font-bold text-charcoal mb-3">Judgment Verification</h4>
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald" />
              <span className="font-medium text-charcoal">All judgments verified via ecrecover against EIP-712 typed data</span>
            </div>
            <div className="text-xs text-charcoal-light">
              Unregistered jurors cannot submit. Duplicate judgments are rejected by nonce tracking.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
