import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeIndexedPool } from "@/lib/graph";
import { quotePool } from "@/lib/quotes";
import { POST } from "./route";

vi.mock("@/lib/graph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/graph")>()),
  analyzeIndexedPool: vi.fn(),
}));
vi.mock("@/lib/quotes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/quotes")>()),
  quotePool: vi.fn(),
}));

const URL =
  "https://app.uniswap.org/explore/pools/ethereum/0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4";

function request(body: unknown): Request {
  return new Request("http://localhost/api/quote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/quote", () => {
  beforeEach(() => {
    vi.mocked(analyzeIndexedPool).mockReset();
    vi.mocked(quotePool).mockReset();
  });

  it("rejects non-positive exact-input values", async () => {
    const response = await POST(
      request({ poolUrl: URL, direction: "token0-to-token1", amountIn: "0" }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("greater than zero");
  });

  it("rejects non-numeric exact-input values", async () => {
    const response = await POST(
      request({
        poolUrl: URL,
        direction: "token0-to-token1",
        amountIn: "not-a-number",
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("valid amount");
  });

  it("returns a successful exact-input result", async () => {
    vi.mocked(analyzeIndexedPool).mockResolvedValue({ version: "v4" } as never);
    vi.mocked(quotePool).mockResolvedValue({
      status: "quoted",
      amountIn: "1",
      amountOut: "3990",
      executionPrice: "3990",
      priceImpactPct: "0.25",
      feePct: "0.05",
      quotedAt: "2026-05-25T18:00:00.000Z",
      samples: [],
    });

    const response = await POST(
      request({ poolUrl: URL, direction: "token0-to-token1", amountIn: "1" }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).priceImpactPct).toBe("0.25");
  });
});
