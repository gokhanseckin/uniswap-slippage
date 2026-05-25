export function AnalyzerDashboard() {
  return (
    <section className="console" aria-label="Pool analyzer">
      <form className="pool-entry">
        <label htmlFor="pool-url">Uniswap pool URL</label>
        <div className="input-track">
          <input
            id="pool-url"
            name="poolUrl"
            type="url"
            placeholder="https://app.uniswap.org/explore/pools/ethereum/0x..."
          />
          <button type="submit">Analyze pool</button>
        </div>
      </form>

      <div className="empty-analysis">
        <div>
          <p className="eyebrow">Range distribution</p>
          <h2>Liquidity bands appear here</h2>
          <p>
            V2 full-range curves, V3 ticks and V4 ranges are resolved after
            analysis.
          </p>
        </div>
        <div className="dormant-bars" aria-hidden="true">
          {Array.from({ length: 11 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
