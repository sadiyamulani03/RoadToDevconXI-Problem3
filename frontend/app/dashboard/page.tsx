import Link from "next/link"
import { Search, Network, ShieldCheck, RefreshCw, Clock, DollarSign, CheckCircle2, AlertTriangle } from "lucide-react"
import { DISTRIBUTION_STATUS } from "../lib/contracts"

const DIST_ID = "0xdevcon8-retro-funding-001"

const STATS = [
  { label: "Funding Pot", value: "100 ETH", icon: <DollarSign className="w-5 h-5 text-forest" />, color: "text-forest" },
  { label: "Packages", value: "10", icon: <Network className="w-5 h-5 text-forest" />, color: "text-forest" },
  { label: "Dependencies", value: "13", icon: <GitBranchIcon className="w-5 h-5 text-emerald" />, color: "text-emerald" },
  { label: "Jurors", value: "3", icon: <Users className="w-5 h-5 text-emerald" />, color: "text-emerald" },
  { label: "Status", value: "Finalized", icon: <CheckCircle2 className="w-5 h-5 text-emerald" />, color: "text-emerald" },
  { label: "Merkle Root", value: "0x3d94...56ef", icon: <ShieldCheck className="w-5 h-5 text-charcoal" />, color: "text-charcoal" },
]

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1={6} y1={3} x2={6} y2={21} />
      <path d="M6 12h12" />
      <path d="M18 3a9 9 0 0 1 9 9c0 1.05-.43 2.05-1.21 2.85" />
    </svg>
  )
}

export default function DashboardPage() {
  return (
    <div className="container-custom py-10">
      <div className="flex flex-col lg:flex-row gap-8 mb-10">
        <div className="flex-grow">
          <h1 className="font-serif font-bold text-3xl text-charcoal mb-2">Protocol Dashboard</h1>
          <p className="text-charcoal-light">Live protocol state for the Devcon 8 retroactive funding distribution.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-outline">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-10">
        {STATS.map((s, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${s.color}/10`}>{s.icon}</div>
              <span className="text-xs font-medium text-charcoal-light uppercase tracking-wider">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-charcoal">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-8">
        <div className="lg:col-span-2 card">
          <h3 className="font-serif font-bold text-lg text-charcoal mb-6">Distribution Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-3">
              <span className="text-charcoal-light">Distribution ID</span>
              <span className="font-mono text-xs text-charcoal">{DIST_ID}</span>
            </div>
            <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-3">
              <span className="text-charcoal-light">Status</span>
              <span className="badge badge-emerald font-medium">FINALIZED</span>
            </div>
            <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-3">
              <span className="text-charcoal-light">Pot Conservation</span>
              <span className="text-emerald font-medium">Exact ✓</span>
            </div>
            <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-3">
              <span className="text-charcoal-light">Merkle Root</span>
              <span className="font-mono text-xs text-charcoal">0x3d948c…56ef1</span>
            </div>
            <div className="flex justify-between text-sm pb-3">
              <span className="text-charcoal-light">Dispute Window</span>
              <span className="text-emerald font-medium">Closed</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 card">
          <h3 className="font-serif font-bold text-lg text-charcoal mb-6">Cycle Detection</h3>
          <div className="p-4 bg-charcoal/5 rounded-lg border border-charcoal-light/20">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-forest" />
              <span className="text-sm font-medium text-forest">1 Cycle Detected</span>
            </div>
            <p className="text-xs text-charcoal-light mb-3">Wallet Connection Wrapper ↔ Ethereum Provider</p>
            <span className="text-xs text-emerald font-medium">Handled via bounded Neumann iteration</span>
          </div>
        </div>

        <div className="lg:col-span-1 card">
          <h3 className="font-serif font-bold text-lg text-charcoal mb-6">Dispute Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-3">
              <span className="text-charcoal-light">Open Disputes</span>
              <span className="badge badge-emerald">0</span>
            </div>
            <div className="flex justify-between text-sm border-b border-charcoal-light/10 pb-3">
              <span className="text-charcoal-light">Resolved</span>
              <span className="text-charcoal-light">0</span>
            </div>
            <div className="flex justify-between text-sm pb-3">
              <span className="text-charcoal-light">Window Status</span>
              <span className="badge badge-emerald">Closed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 card">
        <h3 className="font-serif font-bold text-lg text-charcoal mb-6">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/graph" className="btn-outline flex items-center justify-center gap-2 py-4">
            <Network className="w-5 h-5" /> Graph Explorer
          </Link>
          <Link href="/jury" className="btn-outline flex items-center justify-center gap-2 py-4">
            <Users className="w-5 h-5" /> Jury Explorer
          </Link>
          <Link href="/distribution" className="btn-outline flex items-center justify-center gap-2 py-4">
            <DollarSign className="w-5 h-5" /> Distribution
          </Link>
          <Link href="/claim" className="btn-emerald flex items-center justify-center gap-2 py-4">
            <ShieldCheck className="w-5 h-5" /> Claim Funds
          </Link>
        </div>
      </div>
    </div>
  )
}
