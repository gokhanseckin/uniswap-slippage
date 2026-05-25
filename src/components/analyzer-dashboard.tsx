"use client";

import { useState, type FormEvent } from "react";
import type { PoolAnalysis, QuoteResult, SwapDirection } from "@/lib/domain";
import { LiquidityChart } from "./liquidity-chart";
import { SlippageChart } from "./slippage-chart";

const EXAMPLE_POOL =
  "https://app.uniswap.org/explore/pools/ethereum/0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4";

function formatAmount(value: string | null, maxDecimals = 4): string {
  if (value === null) {
    return "--";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxDecimals,
  }).format(numeric);
}

function feeLabel(feeTier: number | null, dynamicFee: boolean): string {
  if (dynamicFee) {
    return "Dynamic";
  }
  return feeTier === null ? "--" : `${formatAmount(String(feeTier / 10000), 4)}%`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload;
}

interface AnalyzerDashboardProps {
  initialPoolUrl?: string;
}

export function AnalyzerDashboard({
  initialPoolUrl = "",
}: AnalyzerDashboardProps) {
  const [poolUrl, setPoolUrl] = useState(initialPoolUrl);
  const [analysis, setAnalysis] = useState<PoolAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [amountIn, setAmountIn] = useState("1");
  const [direction, setDirection] =
    useState<SwapDirection>("token0-to-token1");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAnalysisLoading(true);
    setAnalysisError(null);
    setQuote(null);
    setQuoteError(null);

    try {
      const result = await postJson<PoolAnalysis>("/api/analyze", { poolUrl });
      setAnalysis(result);
      const query = new URLSearchParams(window.location.search);
      query.set("pool", poolUrl);
      window.history.replaceState(null, "", `?${query.toString()}`);
    } catch (error) {
      setAnalysis(null);
      setAnalysisError(
        error instanceof Error ? error.message : "Unable to analyze this pool.",
      );
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function calculateImpact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!analysis) {
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const result = await postJson<QuoteResult>("/api/quote", {
        poolUrl,
        direction,
        amountIn,
      });
      setQuote(result);
    } catch (error) {
      setQuote(null);
      setQuoteError(
        error instanceof Error ? error.message : "Unable to quote this amount.",
      );
    } finally {
      setQuoteLoading(false);
    }
  }

  const outputSymbol =
    direction === "token0-to-token1"
      ? analysis?.pair.token1.symbol
      : analysis?.pair.token0.symbol;

  return (
    <section className="console" aria-label="Pool analyzer">
      <form className="pool-entry" onSubmit={analyze}>
        <div className="entry-label">
          <label htmlFor="pool-url">Uniswap pool URL</label>
          <button
            className="example-link"
            type="button"
            onClick={() => setPoolUrl(EXAMPLE_POOL)}
          >
            Use example v4 pool
          </button>
        </div>
        <div className="input-track">
          <input
            id="pool-url"
            name="poolUrl"
            type="url"
            value={poolUrl}
            onChange={(event) => setPoolUrl(event.target.value)}
            placeholder="https://app.uniswap.org/explore/pools/ethereum/0x..."
            required
          />
          <button type="submit" disabled={analysisLoading}>
            {analysisLoading ? "Resolving..." : "Analyze pool"}
          </button>
        </div>
      </form>

      {analysisError ? (
        <div className="status-error" role="alert">
          <p className="eyebrow">Analysis unavailable</p>
          <strong>{analysisError}</strong>
          <span>
            Ethereum is enabled now. Other networks appear only after their
            indexed data source is verified.
          </span>
        </div>
      ) : null}

      {!analysis && !analysisError ? (
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
      ) : null}

      {analysis ? (
        <div className="analysis">
          <header className="pool-heading">
            <div>
              <div className="pair-line">
                <h2>
                  {analysis.pair.token0.symbol} / {analysis.pair.token1.symbol}
                </h2>
                <span className="version-badge">
                  {analysis.version.toUpperCase()}
                </span>
              </div>
              <p className="indexed-note">
                {analysis.chain.name} / indexed{" "}
                {new Date(analysis.indexedAt).toLocaleString()}
              </p>
            </div>
            {analysis.hookAddress ? (
              <span className="hook-badge">Hooked pool</span>
            ) : null}
          </header>

          <div className="metric-grid">
            <article>
              <span>Pool value</span>
              <strong>${formatAmount(analysis.tvlUsd, 0)}</strong>
            </article>
            <article>
              <span>Current price</span>
              <strong>
                {formatAmount(analysis.currentPrice)}{" "}
                {analysis.pair.token1.symbol}
              </strong>
            </article>
            <article>
              <span>Fee tier</span>
              <strong>{feeLabel(analysis.feeTier, analysis.dynamicFee)}</strong>
            </article>
            <article>
              <span>{analysis.pair.token0.symbol} amount</span>
              <strong>{formatAmount(analysis.amounts.token0)}</strong>
            </article>
            <article>
              <span>{analysis.pair.token1.symbol} amount</span>
              <strong>{formatAmount(analysis.amounts.token1)}</strong>
            </article>
          </div>

          <div className="chart-stack">
            <LiquidityChart
              bands={analysis.liquidityBands}
              token1Symbol={analysis.pair.token1.symbol}
            />
            <SlippageChart samples={quote?.samples ?? []} />
          </div>

          <form className="quote-strip" onSubmit={calculateImpact}>
            <div className="quote-controls">
              <label htmlFor="swap-direction">Swap direction</label>
              <select
                id="swap-direction"
                value={direction}
                onChange={(event) =>
                  setDirection(event.target.value as SwapDirection)
                }
              >
                <option value="token0-to-token1">
                  {analysis.pair.token0.symbol} to {analysis.pair.token1.symbol}
                </option>
                <option value="token1-to-token0">
                  {analysis.pair.token1.symbol} to {analysis.pair.token0.symbol}
                </option>
              </select>
            </div>
            <div className="quote-controls amount">
              <label htmlFor="swap-amount">Swap amount</label>
              <input
                id="swap-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amountIn}
                onChange={(event) => setAmountIn(event.target.value)}
              />
            </div>
            <button className="quote-action" type="submit" disabled={quoteLoading}>
              {quoteLoading ? "Quoting..." : "Calculate impact"}
            </button>

            <div className="quote-result" aria-live="polite">
              {quote?.status === "quoted" ? (
                <>
                  <div>
                    <span>Estimated output</span>
                    <strong>
                      {formatAmount(quote.amountOut)} {outputSymbol}
                    </strong>
                  </div>
                  <div className="impact">
                    <span>Price impact</span>
                    <strong>{quote.priceImpactPct}%</strong>
                  </div>
                </>
              ) : (
                <p>Enter an amount for a current onchain quote.</p>
              )}
            </div>
          </form>

          {quoteError ? (
            <p className="inline-error" role="alert">
              {quoteError}
            </p>
          ) : null}
          {quote?.status === "conditional" ? (
            <p className="inline-warning" role="alert">
              {quote.warning}
            </p>
          ) : null}
          <footer className="data-disclosure">
            Liquidity ranges use indexed data from The Graph. Quote results
            use read-only contract simulation through Etherscan and are not a
            transaction guarantee.
          </footer>
        </div>
      ) : null}
    </section>
  );
}
