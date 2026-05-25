import type { SlippageSample } from "@/lib/domain";

interface SlippageChartProps {
  samples: SlippageSample[];
}

export function SlippageChart({ samples }: SlippageChartProps) {
  const width = 740;
  const maxImpact = Math.max(
    ...samples.map((sample) => Number(sample.priceImpactPct)),
    1,
  );
  const points = samples
    .map((sample, index) => {
      const x = 28 + (index * 680) / Math.max(samples.length - 1, 1);
      const y = 162 - (Number(sample.priceImpactPct) / maxImpact) * 124;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <figure className="chart-card">
      <figcaption>
        <span>Slippage curve</span>
        <small>Exact-input price impact</small>
      </figcaption>
      {samples.length ? (
        <svg
          viewBox={`0 0 ${width} 194`}
          role="img"
          aria-label="Slippage curve"
          className="curve-chart"
        >
          <path className="chart-baseline" d="M28 162 H708" />
          <polyline className="curve-fill" points={`28,162 ${points} 708,162`} />
          <polyline className="curve-line" points={points} />
          {samples.map((sample, index) => {
            const x = 28 + (index * 680) / Math.max(samples.length - 1, 1);
            const y = 162 - (Number(sample.priceImpactPct) / maxImpact) * 124;
            return (
              <g key={sample.amountIn}>
                <circle className="curve-point" cx={x} cy={y} r="4" />
                <text className="chart-axis-label" x={x - 10} y="183">
                  {sample.amountIn}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="curve-empty">
          Calculate an amount to draw the current impact curve.
        </div>
      )}
    </figure>
  );
}
