import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyzerDashboard } from "./analyzer-dashboard";

const POOL_URL =
  "https://app.uniswap.org/explore/pools/ethereum/0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4";

const ANALYSIS = {
  identifier:
    "0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4",
  chain: { slug: "ethereum", name: "Ethereum Mainnet", chainId: 1 },
  version: "v4",
  pair: {
    token0: { id: "0x0", symbol: "WETH", name: "Ether", decimals: 18 },
    token1: { id: "0x1", symbol: "USDC", name: "USD Coin", decimals: 6 },
  },
  feeTier: 500,
  dynamicFee: false,
  tickSpacing: 60,
  hookAddress: null,
  currentTick: 12,
  currentPrice: "4010.5",
  amounts: { token0: "250", token1: "1000000" },
  tvlUsd: "2002500",
  liquidityBands: [
    {
      id: "-60:60",
      tickLower: -60,
      tickUpper: 60,
      lowerPrice: "3980",
      upperPrice: "4040",
      liquidity: "1000000",
      active: true,
    },
  ],
  indexedAt: "2026-05-25T18:00:00.000Z",
};

const QUOTE = {
  status: "quoted",
  amountIn: "10",
  amountOut: "39830",
  executionPrice: "3983",
  priceImpactPct: "0.6857",
  feePct: "0.05",
  quotedAt: "2026-05-25T18:00:05.000Z",
  samples: [
    { amountIn: "2.5", amountOut: "10020", priceImpactPct: "0.08" },
    { amountIn: "5", amountOut: "20010", priceImpactPct: "0.2" },
    { amountIn: "10", amountOut: "39830", priceImpactPct: "0.6857" },
  ],
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AnalyzerDashboard", () => {
  it("starts with a shared pool URL supplied by the page", () => {
    render(<AnalyzerDashboard initialPoolUrl={POOL_URL} />);

    expect(screen.getByLabelText("Uniswap pool URL")).toHaveValue(POOL_URL);
  });

  it("renders liquidity ranges then quotes a typed swap size", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(ANALYSIS))
      .mockResolvedValueOnce(response(QUOTE));
    vi.stubGlobal("fetch", fetcher);
    render(<AnalyzerDashboard />);

    fireEvent.change(screen.getByLabelText("Uniswap pool URL"), {
      target: { value: POOL_URL },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze pool" }));

    expect(await screen.findByText("V4")).toBeInTheDocument();
    expect(screen.getByText("WETH / USDC")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Liquidity bands" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Swap amount"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate impact" }));

    expect(await screen.findByText("0.6857%")).toBeInTheDocument();
    expect(screen.getByText("39,830 USDC")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Slippage curve" }),
    ).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("shows an actionable analysis error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ error: "Network not enabled." }, 422)),
    );
    render(<AnalyzerDashboard />);

    fireEvent.change(screen.getByLabelText("Uniswap pool URL"), {
      target: { value: POOL_URL },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze pool" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network not enabled.");
    });
  });

  it("identifies dynamic fee v4 pools without showing the sentinel as a rate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({ ...ANALYSIS, feeTier: 8388608, dynamicFee: true }),
      ),
    );
    render(<AnalyzerDashboard />);

    fireEvent.change(screen.getByLabelText("Uniswap pool URL"), {
      target: { value: POOL_URL },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze pool" }));

    expect(await screen.findByText("Dynamic")).toBeInTheDocument();
    expect(screen.queryByText("838.8608%")).not.toBeInTheDocument();
  });
});
