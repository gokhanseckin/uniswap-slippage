import { AnalyzerDashboard } from "@/components/analyzer-dashboard";

export default function Home() {
  return (
    <main className="shell">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          POOL LENS
        </div>
        <p className="network-caption">ETHEREUM MAINNET / LIVE ANALYTICS</p>
      </header>

      <section className="intro">
        <p className="eyebrow">Uniswap liquidity intelligence</p>
        <h1>Map liquidity. Measure impact.</h1>
        <p className="lede">
          Paste any configured Uniswap pool link to identify its protocol,
          inspect active liquidity ranges, and estimate exact-input slippage.
        </p>
      </section>

      <AnalyzerDashboard />
    </main>
  );
}
