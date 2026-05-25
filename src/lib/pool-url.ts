import type { ParsedPoolUrl } from "./domain";
import { getChain } from "./registry";

const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;
const POOL_ID_PATTERN = /^0x[0-9a-f]{64}$/;

export class PoolUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PoolUrlError";
  }
}

export function parsePoolUrl(raw: string): ParsedPoolUrl {
  let parsed: URL;

  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new PoolUrlError("Enter a valid Uniswap pool URL.");
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "app.uniswap.org") {
    throw new PoolUrlError("Use a pool link from app.uniswap.org.");
  }

  const pathParts = parsed.pathname.split("/").filter(Boolean);
  if (
    pathParts.length !== 4 ||
    pathParts[0] !== "explore" ||
    pathParts[1] !== "pools"
  ) {
    throw new PoolUrlError("Use a Uniswap explore pool URL.");
  }

  const chainSlug = pathParts[2].toLowerCase();
  getChain(chainSlug);

  const identifier = pathParts[3].toLowerCase();
  const identifierKind = ADDRESS_PATTERN.test(identifier)
    ? "address"
    : POOL_ID_PATTERN.test(identifier)
      ? "pool-id"
      : null;

  if (!identifierKind) {
    throw new PoolUrlError(
      "Pool identifier must be a contract address or v4 pool ID.",
    );
  }

  return {
    chainSlug,
    identifier: identifier as `0x${string}`,
    identifierKind,
  };
}
