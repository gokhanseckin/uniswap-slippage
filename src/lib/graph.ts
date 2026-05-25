import type {
  ChainConfig,
  LiquidityBand,
  ParsedPoolUrl,
  PoolAnalysis,
  ProtocolVersion,
  TokenSummary,
} from "./domain";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface GraphOptions {
  apiKey?: string;
  fetcher?: Fetcher;
  now?: () => Date;
}

interface GraphToken {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
}

interface GraphTick {
  tickIdx: string;
  liquidityGross: string;
  liquidityNet: string;
  price0: string;
}

interface ConcentratedPool {
  id: string;
  token0: GraphToken;
  token1: GraphToken;
  feeTier: string;
  liquidity: string;
  tick: string | null;
  tickSpacing: string;
  token0Price: string;
  totalValueLockedToken0: string;
  totalValueLockedToken1: string;
  totalValueLockedUSD: string;
  hooks?: string;
  ticks: GraphTick[];
}

interface V2Pair {
  id: string;
  token0: GraphToken;
  token1: GraphToken;
  reserve0: string;
  reserve1: string;
  reserveUSD: string;
  token0Price: string;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const CONCENTRATED_QUERY = `
  query Pool($id: ID!) {
    pool(id: $id) {
      id
      token0 { id symbol name decimals }
      token1 { id symbol name decimals }
      feeTier
      liquidity
      tick
      tickSpacing
      token0Price
      totalValueLockedToken0
      totalValueLockedToken1
      totalValueLockedUSD
      hooks
      ticks(first: 200, orderBy: tickIdx, orderDirection: asc) {
        tickIdx
        liquidityGross
        liquidityNet
        price0
      }
    }
  }
`;

const V3_QUERY = CONCENTRATED_QUERY.replace("\n      hooks", "");

const V2_QUERY = `
  query Pair($id: ID!) {
    pair(id: $id) {
      id
      token0 { id symbol name decimals }
      token1 { id symbol name decimals }
      reserve0
      reserve1
      reserveUSD
      token0Price
    }
  }
`;

export class IndexedDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexedDataError";
  }
}

export class PoolNotFoundError extends IndexedDataError {
  constructor() {
    super("Pool was not found in the configured Uniswap indexes.");
    this.name = "PoolNotFoundError";
  }
}

function tokenSummary(token: GraphToken): TokenSummary {
  return {
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    decimals: Number(token.decimals),
  };
}

function graphKey(options: GraphOptions): string {
  const key = options.apiKey ?? process.env.THE_GRAPH_API_KEY;
  if (!key) {
    throw new IndexedDataError(
      "The Graph API key is not configured on the server.",
    );
  }
  return key;
}

async function querySubgraph<T>(
  subgraphId: string | undefined,
  query: string,
  identifier: string,
  options: GraphOptions,
): Promise<T> {
  if (!subgraphId) {
    throw new IndexedDataError("No indexed endpoint is configured for this version.");
  }

  const fetcher = options.fetcher ?? fetch;
  const endpoint = `https://gateway.thegraph.com/api/${graphKey(options)}/subgraphs/id/${subgraphId}`;
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: identifier } }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new IndexedDataError(
      `The Graph request failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (payload.errors?.length || !payload.data) {
    throw new IndexedDataError(
      payload.errors?.[0]?.message ?? "The Graph response contained no data.",
    );
  }

  return payload.data;
}

function liquidityBands(
  ticks: GraphTick[],
  currentTick: number | null,
): LiquidityBand[] {
  const ordered = [...ticks].sort(
    (left, right) => Number(left.tickIdx) - Number(right.tickIdx),
  );
  let runningLiquidity = 0n;
  const bands: LiquidityBand[] = [];

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const lower = ordered[index];
    const upper = ordered[index + 1];
    runningLiquidity += BigInt(lower.liquidityNet);

    if (runningLiquidity <= 0n) {
      continue;
    }

    const tickLower = Number(lower.tickIdx);
    const tickUpper = Number(upper.tickIdx);
    bands.push({
      id: `${tickLower}:${tickUpper}`,
      tickLower,
      tickUpper,
      lowerPrice: lower.price0,
      upperPrice: upper.price0,
      liquidity: runningLiquidity.toString(),
      active:
        currentTick !== null &&
        currentTick >= tickLower &&
        currentTick < tickUpper,
    });
  }

  return bands;
}

function concentratedAnalysis(
  version: Extract<ProtocolVersion, "v3" | "v4">,
  parsed: ParsedPoolUrl,
  chain: ChainConfig,
  pool: ConcentratedPool,
  indexedAt: string,
): PoolAnalysis {
  const currentTick = pool.tick === null ? null : Number(pool.tick);
  const hookAddress =
    version === "v4" && pool.hooks && pool.hooks !== ZERO_ADDRESS
      ? pool.hooks
      : null;

  return {
    identifier: parsed.identifier,
    chain: { slug: chain.slug, name: chain.name, chainId: chain.chainId },
    version,
    pair: {
      token0: tokenSummary(pool.token0),
      token1: tokenSummary(pool.token1),
    },
    feeTier: Number(pool.feeTier),
    tickSpacing: Number(pool.tickSpacing),
    hookAddress,
    currentTick,
    currentPrice: pool.token0Price,
    amounts: {
      token0: pool.totalValueLockedToken0,
      token1: pool.totalValueLockedToken1,
    },
    tvlUsd: pool.totalValueLockedUSD,
    liquidityBands: liquidityBands(pool.ticks, currentTick),
    indexedAt,
  };
}

function v2Analysis(
  parsed: ParsedPoolUrl,
  chain: ChainConfig,
  pair: V2Pair,
  indexedAt: string,
): PoolAnalysis {
  return {
    identifier: parsed.identifier,
    chain: { slug: chain.slug, name: chain.name, chainId: chain.chainId },
    version: "v2",
    pair: {
      token0: tokenSummary(pair.token0),
      token1: tokenSummary(pair.token1),
    },
    feeTier: 3000,
    tickSpacing: null,
    hookAddress: null,
    currentTick: null,
    currentPrice: pair.token0Price,
    amounts: { token0: pair.reserve0, token1: pair.reserve1 },
    tvlUsd: pair.reserveUSD,
    liquidityBands: [
      {
        id: "full-range",
        label: "Full range",
        tickLower: null,
        tickUpper: null,
        lowerPrice: null,
        upperPrice: null,
        liquidity: pair.reserveUSD,
        active: true,
      },
    ],
    indexedAt,
  };
}

export async function analyzeIndexedPool(
  parsed: ParsedPoolUrl,
  chain: ChainConfig,
  options: GraphOptions = {},
): Promise<PoolAnalysis> {
  const indexedAt = (options.now?.() ?? new Date()).toISOString();

  if (parsed.identifierKind === "pool-id") {
    const data = await querySubgraph<{ pool: ConcentratedPool | null }>(
      chain.subgraphs.v4,
      CONCENTRATED_QUERY,
      parsed.identifier,
      options,
    );

    if (!data.pool) {
      throw new PoolNotFoundError();
    }

    return concentratedAnalysis("v4", parsed, chain, data.pool, indexedAt);
  }

  const v3 = await querySubgraph<{ pool: ConcentratedPool | null }>(
    chain.subgraphs.v3,
    V3_QUERY,
    parsed.identifier,
    options,
  );
  if (v3.pool) {
    return concentratedAnalysis("v3", parsed, chain, v3.pool, indexedAt);
  }

  const v2 = await querySubgraph<{ pair: V2Pair | null }>(
    chain.subgraphs.v2,
    V2_QUERY,
    parsed.identifier,
    options,
  );
  if (v2.pair) {
    return v2Analysis(parsed, chain, v2.pair, indexedAt);
  }

  throw new PoolNotFoundError();
}
