"use client"

import { useEffect, useState } from "react"
import { Search, AlertTriangle } from "lucide-react"
import { useWeb3 } from "../web3-provider.tsx"
import { GRAPH_ABI, CONTRACT_ADDRESSES } from "../contracts.ts"

interface PackageNode {
  address: string
  packageId: string
  retentionRate: string
  active: boolean
}

const POSITIONS: Record<string, { x: number; y: number }> = {
  "0x101": { x: 400, y: 80 },
  "0x102": { x: 150, y: 220 },
  "0x103": { x: 300, y: 220 },
  "0x104": { x: 450, y: 220 },
  "0x105": { x: 100, y: 380 },
  "0x106": { x: 200, y: 380 },
  "0x107": { x: 250, y: 380 },
  "0x108": { x: 400, y: 380 },
  "0x109": { x: 250, y: 480 },
  "0x10a": { x: 500, y: 380 },
}

const CYCLE_NODES = new Set(["0x104", "0x108"])
const SHARED_DEPS = new Set(["0x109", "0x10a"])

const SAMPLE_PACKAGES: PackageNode[] = [
  { address: "0x101", packageId: "0x0000...0101", retentionRate: "50%", active: true },
  { address: "0x102", packageId: "0x0000...0102", retentionRate: "50%", active: true },
  { address: "0x103", packageId: "0x0000...0103", retentionRate: "50%", active: true },
  { address: "0x104", packageId: "0x0000...0104", retentionRate: "50%", active: true },
  { address: "0x105", packageId: "0x0000...0105", retentionRate: "50%", active: true },
  { address: "0x106", packageId: "0x0000...0106", retentionRate: "50%", active: true },
  { address: "0x107", packageId: "0x0000...0107", retentionRate: "50%", active: true },
  { address: "0x108", packageId: "0x0000...0108", retentionRate: "50%", active: true },
  { address: "0x109", packageId: "0x0000...0109", retentionRate: "100%", active: true },
  { address: "0x10a", packageId: "0x0000...010a", retentionRate: "100%", active: true },
]

const SAMPLE_EDGES = [
  { from: "0x101", to: "0x102" }, { from: "0x101", to: "0x103" }, { from: "0x101", to: "0x104" },
  { from: "0x102", to: "0x105" }, { from: "0x102", to: "0x106" },
  { from: "0x103", to: "0x107" },
  { from: "0x104", to: "0x108" }, { from: "0x104", to: "0x10a" },
  { from: "0x105", to: "0x109" }, { from: "0x106", to: "0x109" }, { from: "0x107", to: "0x109" },
  { from: "0x108", to: "0x104" }, { from: "0x108", to: "0x10a" },
]

export default function GraphPage() {
  const { provider } = useWeb3()
  const [packages, setPackages] = useState<PackageNode[]>(SAMPLE_PACKAGES)
  const [edges, setEdges] = useState<{ from: string; to: string }[]>(SAMPLE_EDGES)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!provider) return
    setLoading(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.DependencyGraph || "0x0", GRAPH_ABI, provider)
      contract.getPackages().then((pkgs: string[]) => {
        return Promise.all(pkgs.map(async (p: string) => {
          const data = await contract.getRetention(p)
          return { address: p, packageId: "0x00...00", retentionRate: data.toString(), active: true }
        }))
      }).then((details) => {
        setPackages(details)
        return Promise.all(
          details.map((d) => contract.getDependencies(d.address))
        )
      }).then((allDeps) => {
        const edgeList: { from: string; to: string }[] = []
        details.forEach((d: PackageNode, i: number) => {
          allDeps[i].forEach((dep: string) => edgeList.push({ from: d.address, to: dep }))
        })
        setEdges(edgeList)
      }).catch(() => { /* use sample data */ }).finally(() => setLoading(false))
    } catch {
      setLoading(false)
    }
  }, [provider])

  return (
    <div className="container-custom py-10">
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="flex-grow">
          <h1 className="font-serif font-bold text-3xl text-charcoal mb-2">Dependency Graph Explorer</h1>
          <p className="text-charcoal-light">Interactive visualization of the dependency graph. Cycles are highlighted in red, shared dependencies in green.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-outline">
            <Search className="w-4 h-4 mr-2" /> Search packages
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 card h-[600px] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-charcoal-light/20">
            <h3 className="font-serif font-bold text-lg text-charcoal">Graph Visualization</h3>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-charcoal-light/10 text-charcoal-light">Node: Package</span>
              <span className="px-2 py-1 rounded bg-charcoal-light/10 text-charcoal-light">Edge: Dependency</span>
              <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-100">Red border: Cycle</span>
              <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">Green badge: Shared</span>
            </div>
          </div>
          <div className="flex-grow relative bg-white/50 border border-charcoal-light/20 rounded-lg overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 800 500">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const isCycle = CYCLE_NODES.has(e.from) && CYCLE_NODES.has(e.to)
                return (
                  <line
                    key={i}
                    x1={POSITIONS[e.from]?.x ?? 400} y1={POSITIONS[e.from]?.y ?? 250}
                    x2={POSITIONS[e.to]?.x ?? 400} y2={POSITIONS[e.to]?.y ?? 250}
                    stroke={isCycle ? "#dc2626" : "#9ca3af"}
                    strokeWidth={isCycle ? 3 : 2}
                    strokeDasharray={isCycle ? "6 4" : "none"}
                    markerEnd="url(#arrowhead)"
                  />
                )
              })}
              {packages.map((pkg) => {
                const isCycle = CYCLE_NODES.has(pkg.address)
                const isShared = SHARED_DEPS.has(pkg.address)
                const isSelected = selected === pkg.address
                const isRoot = pkg.address === "0x101"
                return (
                  <g
                    key={pkg.address}
                    onClick={() => setSelected(selected === pkg.address ? null : pkg.address)}
                    className="cursor-pointer"
                    transform={`translate(${POSITIONS[pkg.address]?.x ?? 400}, ${POSITIONS[pkg.address]?.y ?? 250})`}
                  >
                    <circle
                      r={isRoot ? 22 : 18}
                      fill={isRoot ? "#1b4332" : isShared ? "#2d6a4f" : "white"}
                      stroke={isCycle ? "#dc2626" : isSelected ? "#2563eb" : "#9ca3af"}
                      strokeWidth={isRoot || isSelected || isCycle ? 3 : 2}
                    />
                    <text x={0} y={4} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold" pointerEvents="none">
                      {pkg.address.replace("0x", "").slice(-3).toUpperCase()}
                    </text>
                    {isCycle && <circle cx={0} cy={-22} r={6} fill="#dc2626" stroke="white" strokeWidth={2} />}
                    {isShared && !isCycle && <circle cx={0} cy={-22} r={6} fill="#2d6a4f" stroke="white" strokeWidth={2} />}
                  </g>
                )
              })}
            </svg>
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur border border-charcoal-light/20 rounded-lg p-3 text-xs">
              <p className="font-bold text-charcoal">Graph Stats</p>
              <p className="text-charcoal-light text-[10px]">{packages.length} packages</p>
              <p className="text-charcoal-light text-[10px]">{edges.length} dependencies</p>
              <p className="text-charcoal-light text-[10px]">{CYCLE_NODES.size > 0 ? "1 cycle detected" : "No cycles"}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          {selected ? (
            <div className="card h-[600px] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-charcoal-light/20">
                <h3 className="font-serif font-bold text-lg text-charcoal">Package Details</h3>
                <button onClick={() => setSelected(null)} className="text-charcoal-light hover:text-charcoal">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
                </button>
              </div>
              <div className="p-6 flex-grow overflow-y-auto">
                <div className="space-y-6">
                  <div className="p-4 bg-charcoal/5 rounded-lg border border-charcoal-light/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-forest flex items-center justify-center text-white font-bold">
                        {selected.replace("0x", "").slice(-3).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-charcoal">{selected}</div>
                        <div className="text-xs text-charcoal-light">Package Address</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-charcoal-light uppercase tracking-wider">Retention</div>
                        <div className="font-mono text-charcoal">{packages.find(p => p.address === selected)?.retentionRate ?? "50"}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-charcoal-light uppercase tracking-wider">Status</div>
                        <span className="badge badge-forest">Active</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-charcoal mb-3">Incoming Dependencies</h4>
                    <div className="space-y-2">
                      {edges.filter(e => e.to === selected).map((e) => (
                        <div key={e.from} className="flex items-center gap-3 p-3 bg-white border border-charcoal-light/10 rounded-lg text-sm">
                          <span className="font-mono text-xs text-charcoal-light">{e.from}</span>
                          <span className="text-xs text-charcoal-light">→ depends on you</span>
                        </div>
                      ))}
                      {edges.filter(e => e.to === selected).length === 0 && (
                        <p className="text-xs text-charcoal-light">No incoming dependencies</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-charcoal mb-3">Your Dependencies</h4>
                    <div className="space-y-2">
                      {edges.filter(e => e.from === selected).map((e) => (
                        <div key={e.to} className="flex items-center gap-3 p-3 bg-white border border-charcoal-light/10 rounded-lg text-sm">
                          <span className="font-mono text-xs text-charcoal-light">{e.to}</span>
                          <span className="text-xs text-charcoal-light">→ you depend on</span>
                        </div>
                      ))}
                      {edges.filter(e => e.from === selected).length === 0 && (
                        <p className="text-xs text-charcoal-light">No dependencies (leaf package)</p>
                      )}
                    </div>
                  </div>

                  {CYCLE_NODES.has(selected) && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-bold text-red-800">Part of a cycle</span>
                      </div>
                      <p className="text-xs text-red-700">This package is part of a directed cycle. Distribution uses bounded Neumann iteration to guarantee termination.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card h-[600px] flex flex-col items-center justify-center text-charcoal-light">
              <svg className="w-16 h-16 text-charcoal-light/30 mb-4" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              <h3 className="font-bold text-charcoal mb-2">Select a Package</h3>
              <p className="text-sm">Click on any node in the graph to view its details, dependencies, and cycle membership.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
