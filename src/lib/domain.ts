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
