import Decimal from "decimal.js";
import type { SwapDirection } from "./domain";

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

function compact(value: Decimal, significantDigits = 14): string {
  return value.toSignificantDigits(significantDigits).toString();
}

export function priceFromReserves(
  reserve0: bigint,
  reserve1: bigint,
  decimals0: number,
  decimals1: number,
): string {
  const token0 = new Decimal(reserve0.toString()).div(
    new Decimal(10).pow(decimals0),
  );
  const token1 = new Decimal(reserve1.toString()).div(
    new Decimal(10).pow(decimals1),
  );
  return compact(token1.div(token0));
}

export function priceFromSqrtPriceX96(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): string {
  const ratio = new Decimal(sqrtPriceX96.toString())
    .div(new Decimal(2).pow(96))
    .pow(2)
    .mul(new Decimal(10).pow(decimals0 - decimals1));
  return compact(ratio);
}

export function executionPrice(
  amountIn: string,
  amountOut: string,
  direction: SwapDirection,
): string {
  const ratio = new Decimal(amountOut).div(amountIn);
  return compact(direction === "token0-to-token1" ? ratio : new Decimal(1).div(ratio));
}

export function calculatePriceImpactPct(
  amountIn: string,
  amountOut: string,
  spotPrice: string,
  direction: SwapDirection,
): string {
  const expectedOut =
    direction === "token0-to-token1"
      ? new Decimal(amountIn).mul(spotPrice)
      : new Decimal(amountIn).div(spotPrice);
  const impact = Decimal.max(
    0,
    new Decimal(1).minus(new Decimal(amountOut).div(expectedOut)).mul(100),
  );
  return compact(impact, 10);
}

export function feeTierPct(
  feeTier: number | null,
  dynamicFee = false,
): string | null {
  return feeTier === null || dynamicFee
    ? null
    : compact(new Decimal(feeTier).div(10000));
}
