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
    contracts: {
      v3QuoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
      v4Quoter: "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203",
      v4StateView: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227",
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
    contracts: {},
  },
  polygon: {
    slug: "polygon",
    name: "Polygon Mainnet",
    chainId: 137,
    enabled: false,
    disabledReason:
      "Polygon is waiting for verified Uniswap subgraph deployments.",
    subgraphs: {},
    contracts: {},
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
