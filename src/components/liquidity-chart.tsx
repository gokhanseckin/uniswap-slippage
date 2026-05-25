import type { LiquidityBand } from "@/lib/domain";

interface LiquidityChartProps {
  bands: LiquidityBand[];
  token1Symbol: string;
}

function compactPrice(value: string | null): string {
  if (!value) {
    return "FULL";
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    notation: Number(value) > 100000 ? "compact" : "standard",
  }).format(Number(value));
}

export function LiquidityChart({ bands, token1Symbol }: LiquidityChartProps) {
  const values = bands.map((band) => Number(band.liquidity));
  const max = Math.max(...values, 1);
  const width = 740;
  const plotStart = 26;
  const plotEnd = 720;
  const usableWidth = plotEnd - plotStart;
  const columnWidth = usableWidth / Math.max(bands.length, 1);
  const gap = bands.length > 80 ? columnWidth * 0.12 : 8;
  const barWidth = Math.max(0, columnWidth - gap);
  const labelStep = Math.max(1, Math.ceil(bands.length / 8));

  return (
    <figure className="chart-card primary-chart">
      <figcaption>
        <span>Liquidity bands</span>
        <small>Price in {token1Symbol}</small>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} 230`}
        role="img"
        aria-label="Liquidity bands"
        className="band-chart"
      >
        <path className="chart-baseline" d="M22 194 H720" />
        {bands.map((band, index) => {
          const height = Math.max(10, (Number(band.liquidity) / max) * 152);
          const x = plotStart + index * (barWidth + gap);
          const y = 194 - height;
          return (
            <g key={band.id}>
              <rect
                className={band.active ? "band active" : "band"}
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="4"
              />
              {band.active ? (
                <text className="band-active-label" x={x} y={y - 10}>
                  ACTIVE
                </text>
              ) : null}
              {band.active || index % labelStep === 0 ? (
                <text className="chart-axis-label" x={x} y="214">
                  {compactPrice(band.lowerPrice)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
