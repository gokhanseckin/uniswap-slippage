import { encodeFunctionResult, parseUnits } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { PoolAnalysis } from "./domain";
import {
  quotePool,
  V2_PAIR_ABI,
  V3_POOL_ABI,
  V3_QUOTER_ABI,
} from "./quotes";

function analysis(version: PoolAnalysis["version"]): PoolAnalysis {
  return {
    identifier: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
    chain: { slug: "ethereum", name: "Ethereum Mainnet", chainId: 1 },
    version,
    pair: {
      token0: {
        id: "0x0000000000000000000000000000000000000001",
        symbol: "AAA",
        name: "Alpha",
        decimals: 18,
      },
      token1: {
        id: "0x0000000000000000000000000000000000000002",
        symbol: "BBB",
        name: "Beta",
        decimals: 18,
      },
    },
    feeTier: 3000,
    dynamicFee: false,
    tickSpacing: 60,
    hookAddress: null,
    currentTick: 0,
    currentPrice: "1",
    amounts: { token0: "1000", token1: "1000" },
    tvlUsd: "2000",
    liquidityBands: [],
    indexedAt: "2026-05-25T18:00:00.000Z",
  };
}

describe("quotePool", () => {
  it("quotes a v2 exact input from live reserves", async () => {
    const call = vi.fn().mockResolvedValue(
      encodeFunctionResult({
        abi: V2_PAIR_ABI,
        functionName: "getReserves",
        result: [parseUnits("1000", 18), parseUnits("1000", 18), 0],
      }),
    );

    const result = await quotePool(
      {
        analysis: analysis("v2"),
        direction: "token0-to-token1",
        amountIn: "1",
      },
      { call },
    );

    expect(result.status).toBe("quoted");
    expect(Number(result.priceImpactPct)).toBeGreaterThan(0.3);
    expect(result.samples.length).toBeGreaterThan(2);
  });

  it("uses the v3 pool state and quoter output for live impact", async () => {
    const call = vi.fn().mockImplementation(async (_chainId, to) => {
      if (to.toLowerCase() === analysis("v3").identifier) {
        return encodeFunctionResult({
          abi: V3_POOL_ABI,
          functionName: "slot0",
          result: [2n ** 96n, 0, 0, 0, 0, 0, true],
        });
      }

      return encodeFunctionResult({
        abi: V3_QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        result: [parseUnits("0.99", 18), 2n ** 96n, 0, 120000n],
      });
    });

    const result = await quotePool(
      {
        analysis: analysis("v3"),
        direction: "token0-to-token1",
        amountIn: "1",
      },
      { call, wait: async () => undefined },
    );

    expect(result.status).toBe("quoted");
    expect(result.amountOut).toBe("0.99");
    expect(result.priceImpactPct).toBe("1");
  });

  it("labels a failed hooked v4 quote as conditional", async () => {
    const hooked = {
      ...analysis("v4"),
      identifier:
        "0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4",
      hookAddress: "0x0000000000000000000000000000000000000042",
    };

    const result = await quotePool(
      { analysis: hooked, direction: "token0-to-token1", amountIn: "1" },
      { call: vi.fn().mockRejectedValue(new Error("execution reverted")) },
    );

    expect(result.status).toBe("conditional");
    expect(result.warning).toContain("hook");
  });
});
