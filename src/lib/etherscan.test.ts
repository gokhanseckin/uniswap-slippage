import { describe, expect, it, vi } from "vitest";
import { ethCall, EtherscanError } from "./etherscan";

describe("ethCall", () => {
  it("sends a read-only Etherscan V2 proxy request for the selected chain", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1234" }), {
        status: 200,
      }),
    );

    const result = await ethCall(
      1,
      "0x0000000000000000000000000000000000000042",
      "0xabcdef",
      { apiKey: "scan-key", fetcher },
    );

    expect(result).toBe("0x1234");
    const requested = new URL(String(fetcher.mock.calls[0][0]));
    expect(requested.searchParams.get("chainid")).toBe("1");
    expect(requested.searchParams.get("action")).toBe("eth_call");
    expect(requested.searchParams.get("apikey")).toBe("scan-key");
  });

  it("reports server configuration when no Etherscan key is supplied", async () => {
    await expect(
      ethCall(1, "0x0000000000000000000000000000000000000042", "0x", {
        apiKey: "",
      }),
    ).rejects.toBeInstanceOf(EtherscanError);
  });
});
