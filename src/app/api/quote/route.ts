import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import type { SwapDirection } from "@/lib/domain";
import { EtherscanError } from "@/lib/etherscan";
import { analyzeIndexedPool, IndexedDataError, PoolNotFoundError } from "@/lib/graph";
import { parsePoolUrl, PoolUrlError } from "@/lib/pool-url";
import { quotePool, QuoteError } from "@/lib/quotes";
import {
  ChainNotEnabledError,
  getEnabledChain,
  NetworkConfigurationError,
} from "@/lib/registry";

function isDirection(value: unknown): value is SwapDirection {
  return value === "token0-to-token1" || value === "token1-to-token0";
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as {
      poolUrl?: unknown;
      direction?: unknown;
      amountIn?: unknown;
    };
    if (
      typeof input.poolUrl !== "string" ||
      typeof input.amountIn !== "string" ||
      !isDirection(input.direction)
    ) {
      return NextResponse.json({ error: "Enter a valid swap request." }, { status: 400 });
    }

    let amount: Decimal;
    try {
      amount = new Decimal(input.amountIn);
    } catch {
      return NextResponse.json(
        { error: "Enter a valid amount to quote." },
        { status: 400 },
      );
    }

    if (!amount.isFinite()) {
      return NextResponse.json(
        { error: "Enter a valid amount to quote." },
        { status: 400 },
      );
    }

    if (!amount.greaterThan(0)) {
      return NextResponse.json(
        { error: "Swap amount must be greater than zero." },
        { status: 400 },
      );
    }

    const parsed = parsePoolUrl(input.poolUrl);
    const chain = getEnabledChain(parsed.chainSlug);
    const analysis = await analyzeIndexedPool(parsed, chain);
    const result = await quotePool({
      analysis,
      direction: input.direction,
      amountIn: input.amountIn,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PoolUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error instanceof ChainNotEnabledError ||
      error instanceof NetworkConfigurationError
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof PoolNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof QuoteError ||
      error instanceof EtherscanError ||
      error instanceof IndexedDataError
    ) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Unable to quote this swap right now." },
      { status: 500 },
    );
  }
}
