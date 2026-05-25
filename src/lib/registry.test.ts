import { describe, expect, it } from "vitest";
import { ChainNotEnabledError, getChain, getEnabledChain } from "./registry";

describe("network registry", () => {
  it("enables documented Ethereum v2, v3 and v4 subgraphs", () => {
    const ethereum = getEnabledChain("ethereum");

    expect(ethereum.chainId).toBe(1);
    expect(ethereum.subgraphs).toEqual({
      v2: "A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum",
      v3: "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV",
      v4: "DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G",
    });
  });

  it("lists Arbitrum and Polygon but does not promise unverified indexing", () => {
    expect(getChain("arbitrum").enabled).toBe(false);
    expect(getChain("polygon").enabled).toBe(false);
    expect(() => getEnabledChain("arbitrum")).toThrow(ChainNotEnabledError);
  });

  it("rejects a chain not in the configured registry", () => {
    expect(() => getChain("base")).toThrow("This network is not configured.");
  });
});
