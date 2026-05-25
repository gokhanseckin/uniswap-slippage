import { describe, expect, it, vi } from "vitest";
import { analyzeIndexedPool } from "./graph";
import { parsePoolUrl } from "./pool-url";
import { getEnabledChain } from "./registry";

const V4_URL =
  "https://app.uniswap.org/explore/pools/ethereum/0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4";
const V3_URL =
  "https://app.uniswap.org/explore/pools/ethereum/0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";

function graphResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("analyzeIndexedPool", () => {
  it("normalizes v4 pool IDs with active liquidity bands and hooks", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      graphResponse({
        pool: {
          id: "0xpool",
          token0: { id: "0x0", symbol: "WETH", name: "Ether", decimals: "18" },
          token1: { id: "0x1", symbol: "USDC", name: "USD Coin", decimals: "6" },
          feeTier: "500",
          liquidity: "1000000",
          tick: "12",
          tickSpacing: "60",
          token0Price: "4010.5",
          totalValueLockedToken0: "250",
          totalValueLockedToken1: "1000000",
          totalValueLockedUSD: "2002500",
          hooks: "0x0000000000000000000000000000000000000042",
          ticks: [
            {
              tickIdx: "-60",
              liquidityGross: "1000000",
              liquidityNet: "1000000",
              price0: "3980",
            },
            {
              tickIdx: "60",
              liquidityGross: "1000000",
              liquidityNet: "-1000000",
              price0: "4040",
            },
          ],
        },
      }),
    );

    const result = await analyzeIndexedPool(
      parsePoolUrl(V4_URL),
      getEnabledChain("ethereum"),
      { apiKey: "graph-key", fetcher, now: () => new Date("2026-05-25T18:00:00Z") },
    );

    expect(result.version).toBe("v4");
    expect(result.pair.token0.symbol).toBe("WETH");
    expect(result.hookAddress).toBe(
      "0x0000000000000000000000000000000000000042",
    );
    expect(result.liquidityBands).toEqual([
      expect.objectContaining({
        tickLower: -60,
        tickUpper: 60,
        active: true,
        liquidity: "1000000",
      }),
    ]);
  });

  it("looks up an address as v3 before falling back to v2", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(graphResponse({ pool: null }))
      .mockResolvedValueOnce(
        graphResponse({
          pair: {
            id: "0xpair",
            token0: { id: "0x0", symbol: "UNI", name: "Uniswap", decimals: "18" },
            token1: { id: "0x1", symbol: "WETH", name: "Ether", decimals: "18" },
            reserve0: "50000",
            reserve1: "100",
            reserveUSD: "400000",
            token0Price: "0.002",
          },
        }),
      );

    const result = await analyzeIndexedPool(
      parsePoolUrl(V3_URL),
      getEnabledChain("ethereum"),
      { apiKey: "graph-key", fetcher },
    );

    expect(result.version).toBe("v2");
    expect(result.liquidityBands[0]).toMatchObject({
      label: "Full range",
      active: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("normalizes an address lookup returned by the v3 index", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      graphResponse({
        pool: {
          id: "0xpool",
          token0: { id: "0x0", symbol: "WETH", name: "Ether", decimals: "18" },
          token1: { id: "0x1", symbol: "USDC", name: "USD Coin", decimals: "6" },
          feeTier: "3000",
          liquidity: "720000",
          tick: "0",
          tickSpacing: "60",
          token0Price: "4012",
          totalValueLockedToken0: "20",
          totalValueLockedToken1: "80240",
          totalValueLockedUSD: "160480",
          ticks: [
            {
              tickIdx: "-120",
              liquidityGross: "720000",
              liquidityNet: "720000",
              price0: "3950",
            },
            {
              tickIdx: "120",
              liquidityGross: "720000",
              liquidityNet: "-720000",
              price0: "4075",
            },
          ],
        },
      }),
    );

    const result = await analyzeIndexedPool(
      parsePoolUrl(V3_URL),
      getEnabledChain("ethereum"),
      { apiKey: "graph-key", fetcher },
    );

    expect(result.version).toBe("v3");
    expect(result.feeTier).toBe(3000);
    expect(result.liquidityBands[0].active).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
