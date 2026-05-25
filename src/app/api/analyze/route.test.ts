import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { analyzeIndexedPool } from "@/lib/graph";

vi.mock("@/lib/graph", () => ({
  analyzeIndexedPool: vi.fn(),
}));

const POOL_ID =
  "0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4";

function request(poolUrl: string): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    body: JSON.stringify({ poolUrl }),
  });
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    vi.mocked(analyzeIndexedPool).mockReset();
  });

  it("rejects malformed pool URLs", async () => {
    const response = await POST(request("not a url"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Enter a valid Uniswap pool URL.",
    });
  });

  it("does not expose a configured network before indexed endpoints are verified", async () => {
    const response = await POST(
      request(`https://app.uniswap.org/explore/pools/arbitrum/${POOL_ID}`),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("waiting for verified");
  });

  it("returns normalized analysis for an enabled pool", async () => {
    vi.mocked(analyzeIndexedPool).mockResolvedValue({
      identifier: POOL_ID,
      chain: { slug: "ethereum", name: "Ethereum Mainnet", chainId: 1 },
      version: "v4",
      pair: {
        token0: { id: "0x0", symbol: "WETH", name: "Ether", decimals: 18 },
        token1: { id: "0x1", symbol: "USDC", name: "USD Coin", decimals: 6 },
      },
      feeTier: 500,
      tickSpacing: 60,
      hookAddress: null,
      currentTick: 12,
      currentPrice: "4010.5",
      amounts: { token0: "250", token1: "1000000" },
      tvlUsd: "2002500",
      liquidityBands: [],
      indexedAt: "2026-05-25T18:00:00.000Z",
    });

    const response = await POST(
      request(`https://app.uniswap.org/explore/pools/ethereum/${POOL_ID}`),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).version).toBe("v4");
  });
});
