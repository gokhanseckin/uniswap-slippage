import { NextResponse } from "next/server";
import { analyzeIndexedPool, IndexedDataError, PoolNotFoundError } from "@/lib/graph";
import { parsePoolUrl, PoolUrlError } from "@/lib/pool-url";
import {
  ChainNotEnabledError,
  getEnabledChain,
  NetworkConfigurationError,
} from "@/lib/registry";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { poolUrl?: unknown };
    if (typeof input.poolUrl !== "string") {
      throw new PoolUrlError("Enter a valid Uniswap pool URL.");
    }

    const parsed = parsePoolUrl(input.poolUrl);
    const chain = getEnabledChain(parsed.chainSlug);
    const analysis = await analyzeIndexedPool(parsed, chain);

    return NextResponse.json(analysis);
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

    if (error instanceof IndexedDataError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json(
      { error: "Unable to analyze this pool right now." },
      { status: 500 },
    );
  }
}
