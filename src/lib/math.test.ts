import { describe, expect, it } from "vitest";
import {
  calculatePriceImpactPct,
  feeTierPct,
  priceFromReserves,
  priceFromSqrtPriceX96,
  priceFromTick,
} from "./math";

describe("quote math", () => {
  it("calculates token0 to token1 impact against the current price", () => {
    expect(
      calculatePriceImpactPct("1", "3990", "4000", "token0-to-token1"),
    ).toBe("0.25");
  });

  it("calculates the current human price from raw v2 reserves", () => {
    expect(
      priceFromReserves(
        100000000000000000000n,
        400000000000n,
        18,
        6,
      ),
    ).toBe("4000");
  });

  it("adjusts a sqrt ratio for token decimal precision", () => {
    expect(priceFromSqrtPriceX96(2n ** 96n, 18, 6)).toBe("1000000000000");
  });

  it("adjusts concentrated-liquidity tick ratios for token decimals", () => {
    const price = Number(priceFromTick(-276324, 18, 6));

    expect(price).toBeGreaterThan(0.9);
    expect(price).toBeLessThan(1.1);
  });

  it("does not present a v4 dynamic fee flag as a fixed fee percentage", () => {
    expect(feeTierPct(8388608, true)).toBeNull();
  });
});
