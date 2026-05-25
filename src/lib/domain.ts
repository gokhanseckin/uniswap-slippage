export type ProtocolVersion = "v2" | "v3" | "v4";
export type PoolIdentifierKind = "address" | "pool-id";

export interface ParsedPoolUrl {
  chainSlug: string;
  identifier: `0x${string}`;
  identifierKind: PoolIdentifierKind;
}

export interface ChainConfig {
  slug: string;
  name: string;
  chainId: number;
  enabled: boolean;
  disabledReason?: string;
  subgraphs: Partial<Record<ProtocolVersion, string>>;
}

export interface TokenSummary {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface LiquidityBand {
  id: string;
  label?: string;
  tickLower: number | null;
  tickUpper: number | null;
  lowerPrice: string | null;
  upperPrice: string | null;
  liquidity: string;
  active: boolean;
}

export interface PoolAnalysis {
  identifier: string;
  chain: Pick<ChainConfig, "slug" | "name" | "chainId">;
  version: ProtocolVersion;
  pair: {
    token0: TokenSummary;
    token1: TokenSummary;
  };
  feeTier: number | null;
  hookAddress: string | null;
  currentTick: number | null;
  currentPrice: string | null;
  amounts: {
    token0: string;
    token1: string;
  };
  tvlUsd: string | null;
  liquidityBands: LiquidityBand[];
  indexedAt: string;
}
