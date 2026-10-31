import Link from "next/link"
import { ArrowRight, GitBranch, Share2, ShieldCheck, Zap, Network } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <nav className="border-b border-charcoal-light/20 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="container-custom flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-2 font-serif font-bold text-2xl text-forest tracking-tight">
            Pay the Wells You Drank From
          </Link>
          <div className="flex gap-4">
            <Link href="/dashboard" className="text-sm font-medium text-charcoal hover:text-forest transition-colors">
              Dashboard
            </Link>
            <Link href="/graph" className="text-sm font-medium text-charcoal hover:text-forest transition-colors">
              Graph Explorer
            </Link>
            <Link href="/claim" className="btn-primary">
              Connect Wallet
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        <section className="relative py-20 lg:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10"></div>
          <div className="container-custom relative z-10 text-center">
            <h1 className="font-serif font-bold text-5xl lg:text-7xl text-charcoal tracking-tight mb-6 leading-tight">
              Trace every contribution.<br />
              <span className="text-forest">Reward every dependency.</span>
            </h1>
            <p className="text-lg text-charcoal-light max-w-2xl mx-auto mb-10 leading-relaxed">
              Retroactive public-goods funding that flows through open-source dependency graphs.
              Packages retain a portion of funding and redistribute the rest to their dependencies,
              weighted by independently verified jury judgments.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard" className="btn-primary flex items-center justify-center gap-2">
                View Protocol <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/graph" className="btn-outline flex items-center justify-center gap-2">
                Explore Graph <Network className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20 bg-charcoal/5">
          <div className="container-custom">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "Dependency-Based Distribution",
                  icon: <GitBranch className="w-8 h-8 text-forest" />,
                  desc: "Funding flows through dependency graphs. Every package receives an allocation, retains its share, and redistributes the rest to its dependencies.",
                },
                {
                  title: "Pairwise Jury Judgments",
                  icon: <Share2 className="w-8 h-8 text-forest" />,
                  desc: "A registered jury evaluates pairwise package importance. Judgments are EIP-712 signed and converted into deterministic importance weights.",
                },
                {
                  title: "Merkle Commitments & Claims",
                  icon: <ShieldCheck className="w-8 h-8 text-emerald" />,
                  desc: "Allocations are committed via Merkle root. Recipients verify proofs and claim funds permissionlessly with double-claim protection.",
                },
              ].map((item, i) => (
                <div key={i} className="card">
                  <div className="mb-4">{item.icon}</div>
                  <h3 className="font-serif font-bold text-xl text-charcoal mb-3">{item.title}</h3>
                  <p className="text-charcoal-light leading-relaxed text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container-custom">
            <h2 className="font-serif font-bold text-3xl text-charcoal mb-12 text-center">How Funding Flows</h2>
            <div className="max-w-4xl mx-auto">
              <div className="card">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="md:w-1/3 space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-forest/10 rounded-lg border border-forest/20">
                      <div className="w-12 h-12 rounded-full bg-forest flex items-center justify-center text-white font-bold">A</div>
                      <div>
                        <div className="font-bold text-charcoal">Devcon Event App</div>
                        <div className="text-xs text-charcoal-light">Root application</div>
                      </div>
                    </div>
                    <div className="h-px bg-charcoal-light/40 mx-2"></div>
                    <div className="flex items-center gap-3 p-4 bg-emerald/10 rounded-lg border border-emerald/20">
                      <div className="w-12 h-12 rounded-full bg-emerald flex items-center justify-center text-white font-bold">B</div>
                      <div>
                        <div className="font-bold text-charcoal">QR Ticketing Library</div>
                        <div className="text-xs text-charcoal-light">Receives from app, retains 50%</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-grow">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg border border-charcoal-light/20 bg-white">
                        <div className="text-xs text-charcoal-light uppercase tracking-wider font-medium">50%</div>
                        <div className="font-bold text-charcoal">Retained</div>
                        <div className="text-xs text-emerald mt-1">$50,000</div>
                      </div>
                      <div className="p-4 rounded-lg border border-charcoal-light/20 bg-white">
                        <div className="text-xs text-charcoal-light uppercase tracking-wider font-medium">50%</div>
                        <div className="font-bold text-charcoal">Redistributed</div>
                        <div className="text-xs text-emerald mt-1">$50,000</div>
                      </div>
                      <div className="p-4 rounded-lg border border-charcoal-light/20 bg-white">
                        <div className="text-xs text-charcoal-light uppercase tracking-wider font-medium">Final</div>
                        <div className="font-bold text-charcoal">Allocation</div>
                        <div className="text-xs text-emerald mt-1">$50,000+</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-charcoal-light/20 bg-white py-12 mt-auto">
        <div className="container-custom flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 font-serif font-bold text-xl text-forest">
            Pay the Wells You Drank From
          </div>
          <p className="text-xs text-charcoal-light">Devcon 8 Retroactive Funding Challenge</p>
        </div>
      </footer>
    </div>
  )
}
