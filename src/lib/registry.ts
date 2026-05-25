import type { ChainConfig } from "./domain";

const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    slug: "ethereum",
    name: "Ethereum Mainnet",
    chainId: 1,
    enabled: true,
    subgraphs: {
      v2: "A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum",
      v3: "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV",
      v4: "DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G",
    },
  },
  arbitrum: {
    slug: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    enabled: false,
    disabledReason:
      "Arbitrum is waiting for verified Uniswap subgraph deployments.",
    subgraphs: {},
  },
  polygon: {
    slug: "polygon",
    name: "Polygon Mainnet",
    chainId: 137,
    enabled: false,
    disabledReason:
      "Polygon is waiting for verified Uniswap subgraph deployments.",
    subgraphs: {},
  },
};

export class NetworkConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkConfigurationError";
  }
}

export class ChainNotEnabledError extends NetworkConfigurationError {
  constructor(chain: ChainConfig) {
    super(
      chain.disabledReason ??
        `${chain.name} is configured but is not enabled for analysis.`,
    );
    this.name = "ChainNotEnabledError";
  }
}

export function getChain(slug: string): ChainConfig {
  const chain = CHAINS[slug.toLowerCase()];

  if (!chain) {
    throw new NetworkConfigurationError("This network is not configured.");
  }

  return chain;
}

export function getEnabledChain(slug: string): ChainConfig {
  const chain = getChain(slug);

  if (!chain.enabled) {
    throw new ChainNotEnabledError(chain);
  }

  return chain;
}

export function getAllChains(): ChainConfig[] {
  return Object.values(CHAINS);
}
