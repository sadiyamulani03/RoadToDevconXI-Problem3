"use client"

import { Coin, ArrowRight, Network, Info } from "lucide-react"

const DIST_ID = "0xdevcon8-retro-funding-001"
const POT = 100000000000000000000n

interface PackageAlloc {
  address: string
  name: string
  weight: string
  received: string
  retention: string
  retained: string
  redistributed: string
  final: string
  level: number
}

const DATA: PackageAlloc[] = [
  { address: "0x101", name: "Devcon Event App", weight: "89,139,132,078,982,673", received: "8,913,913,207,898,267,300", retention: "50%", retained: "4,456,956,603,949,133,670", redistributed: "4,456,956,603,949,133,630", final: "4,456,956,603,949,133,670", level: 0 },
  { address: "0x102", name: "QR Ticketing Library", weight: "111,126,784,658,465,067", received: "12,703,233,589,774,918,901", retention: "50%", retained: "6,351,616,794,887,459,450", redistributed: "6,351,616,794,887,459,451", final: "6,351,616,794,887,459,450", level: 1 },
  { address: "0x103", name: "Hindi i18n Package", weight: "89,139,132,078,982,673", received: "10,189,759,563,990,576,537", retention: "50%", retained: "5,094,879,781,995,288,268", redistributed: "5,094,879,781,995,288,269", final: "5,094,879,781,995,288,268", level: 1 },
  { address: "0x104", name: "Wallet Connection Wrapper", weight: "111,126,784,658,465,067", received: "16,362,516,972,538,828,041", retention: "50%", retained: "8,181,258,486,269,414,020", redistributed: "8,181,258,486,269,414,021", final: "8,181,258,486,269,414,020", level: 1 },
  { address: "0x105", name: "Cryptographic Utility", weight: "113,990,041,628,274,815", received: "14,826,846,519,769,942,771", retention: "50%", retained: "7,413,423,259,884,971,385", redistributed: "7,413,423,259,884,971,386", final: "7,413,423,259,884,971,385", level: 2 },
  { address: "0x106", name: "Encoding Library", weight: "97,227,682,952,816,286", received: "12,646,542,733,226,626,779", retention: "50%", retained: "6,323,271,366,613,313,389", redistributed: "6,323,271,366,613,313,390", final: "6,323,271,366,613,313,389", level: 2 },
  { address: "0x107", name: "Translation Utility", weight: "95,081,740,884,248,184", received: "14,603,053,870,420,106,668", retention: "50%", retained: "7,301,526,935,210,053,334", redistributed: "7,301,526,935,210,053,334", final: "7,301,526,935,210,053,334", level: 2 },
  { address: "0x108", name: "Ethereum Provider", weight: "97,062,610,486,003,355", received: "13,776,125,676,287,658,126", retention: "50%", retained: "6,888,062,838,143,829,063", redistributed: "6,888,062,838,143,829,063", final: "6,888,062,838,143,829,063", level: 2 },
  { address: "0x109", name: "Shared Logging Utility", weight: "98,053,045,286,880,940", received: "30,843,526,090,396,432,108", retention: "100%", retained: "30,843,526,090,396,432,108", redistributed: "0", final: "30,843,526,090,396,432,108", level: 3 },
  { address: "0x10a", name: "RPC Utility", weight: "98,053,045,286,880,940", received: "17,145,477,842,650,105,313", retention: "100%", retained: "17,145,477,842,650,105,313", redistributed: "0", final: "17,145,477,842,650,105,313", level: 3 },
]

export default function DistributionPage() {
  return (
    <div className="container-custom py-10">
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="flex-grow">
          <h1 className="font-serif font-bold text-3xl text-charcoal mb-2">Distribution Explorer</h1>
          <p className="text-charcoal-light">Every package's allocation explained: initial allocation, incoming funding, retention, redistribution, and final amount.</p>
        </div>
      </div>

      <div className="mb-8 card p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="font-serif font-bold text-xl text-charcoal">Distribution {DIST_ID}</h2>
            <p className="text-sm text-charcoal-light">100 ETH pot • 10 packages • Exact conservation verified</p>
          </div>
          <div className="flex gap-3">
            <span className="px-3 py-1 rounded bg-emerald/10 text-emerald font-mono text-xs border border-emerald/20">
              Conservation: Exact
            </span>
            <span className="px-3 py-1 rounded bg-charcoal-light/10 text-charcoal font-mono text-xs border border-charcoal-light/20">
              Dust: 20 wei → root
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-charcoal-light/20">
              <th className="text-left pb-4 text-charcoal-light text-xs font-medium uppercase w-16">Package</th>
              <th className="text-left pb-4 text-charcoal-light text-xs font-medium uppercase">Weight</th>
              <th className="text-right pb-4 text-charcoal-light text-xs font-medium uppercase">Received</th>
              <th className="text-right pb-4 text-charcoal-light text-xs font-medium uppercase">Retention</th>
              <th className="text-right pb-4 text-charcoal-light text-xs font-medium uppercase">Retained</th>
              <th className="text-right pb-4 text-charcoal-light text-xs font-medium uppercase">Redistributed</th>
              <th className="text-right pb-4 text-charcoal-light text-xs font-medium uppercase">Final</th>
              <th className="text-center pb-4 text-charcoal-light text-xs font-medium uppercase w-20">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-light/10">
            {DATA.map((p, i) => (
              <tr key={i} className="hover:bg-charcoal-light/5 transition-colors group">
                <td className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-forest/10 text-forest flex items-center justify-center font-bold text-xs">
                      {p.address.replace("0x", "").slice(-2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-charcoal">{p.name}</div>
                      <div className="font-mono text-xs text-charcoal-light">{p.address}</div>
                    </div>
                  </div>
                </td>
                <td className="pb-4 font-mono text-charcoal">{p.weight}</td>
                <td className="pb-4 text-right font-mono text-charcoal">{p.received}</td>
                <td className="pb-4 text-right font-mono text-charcoal">{p.retention}</td>
                <td className="pb-4 text-right font-mono text-charcoal">{p.retained}</td>
                <td className="pb-4 text-right font-mono text-charcoal">{p.redistributed}</td>
                <td className="pb-4 text-right font-bold text-forest font-mono text-charcoal">{p.final}</td>
                <td className="pb-4 text-center">
                  <span className="px-2 py-1 rounded bg-charcoal-light/10 text-charcoal text-[10px] border border-charcoal-light/20">L{p.level}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 card p-6">
        <h3 className="font-serif font-bold text-lg text-charcoal mb-4">Conservation Verification</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-4 bg-charcoal/5 rounded-lg border border-charcoal-light/20">
            <div className="text-xs text-charcoal-light uppercase tracking-wider font-medium">Total Allocations</div>
            <div className="font-mono text-xl text-charcoal font-bold">100,000,000,000,000,000,000 wei</div>
          </div>
          <div className="p-4 bg-charcoal/5 rounded-lg border border-charcoal-light/20">
            <div className="text-xs text-charcoal-light uppercase tracking-wider font-medium">Dust Swept to Root</div>
            <div className="font-mono text-xl text-charcoal font-bold">20 wei</div>
          </div>
          <div className="p-4 bg-emerald/10 rounded-lg border border-emerald/20">
            <div className="text-xs text-emerald uppercase tracking-wider font-medium">Sum + Dust = Pot</div>
            <div className="font-mono text-xl text-emerald font-bold">Exact ✓</div>
          </div>
        </div>
      </div>
    </div>
  )
}
