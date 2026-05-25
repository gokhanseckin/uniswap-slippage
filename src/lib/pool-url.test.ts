import { describe, expect, it } from "vitest";
import { parsePoolUrl, PoolUrlError } from "./pool-url";

const EXAMPLE_V4_URL =
  "https://app.uniswap.org/explore/pools/ethereum/0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4";

describe("parsePoolUrl", () => {
  it("parses the supplied Ethereum v4 pool link", () => {
    expect(parsePoolUrl(EXAMPLE_V4_URL)).toEqual({
      chainSlug: "ethereum",
      identifier:
        "0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4",
      identifierKind: "pool-id",
    });
  });

  it("accepts an address identifier as a v2 or v3 lookup candidate", () => {
    const parsed = parsePoolUrl(
      "https://app.uniswap.org/explore/pools/ethereum/0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
    );

    expect(parsed.identifierKind).toBe("address");
  });

  it("rejects a URL outside the official pool explorer path", () => {
    expect(() =>
      parsePoolUrl("https://example.com/explore/pools/ethereum/0x1234"),
    ).toThrow(PoolUrlError);
  });

  it("rejects malformed pool identifiers", () => {
    expect(() =>
      parsePoolUrl("https://app.uniswap.org/explore/pools/ethereum/0x1234"),
    ).toThrow("Pool identifier must be a contract address or v4 pool ID.");
  });
});
