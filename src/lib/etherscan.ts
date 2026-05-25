import type { Hex } from "viem";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface EtherscanOptions {
  apiKey?: string;
  fetcher?: Fetcher;
}

export class EtherscanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EtherscanError";
  }
}

export class EtherscanCallError extends EtherscanError {
  constructor(message: string) {
    super(message);
    this.name = "EtherscanCallError";
  }
}

export async function ethCall(
  chainId: number,
  to: `0x${string}`,
  data: Hex,
  options: EtherscanOptions = {},
): Promise<Hex> {
  const apiKey =
    options.apiKey !== undefined ? options.apiKey : process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new EtherscanError("The Etherscan API key is not configured on the server.");
  }

  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", String(chainId));
  url.searchParams.set("module", "proxy");
  url.searchParams.set("action", "eth_call");
  url.searchParams.set("to", to);
  url.searchParams.set("data", data);
  url.searchParams.set("tag", "latest");
  url.searchParams.set("apikey", apiKey);

  const response = await (options.fetcher ?? fetch)(url, { cache: "no-store" });
  if (!response.ok) {
    throw new EtherscanError(
      `Etherscan request failed with status ${response.status}.`,
    );
  }

  const result = (await response.json()) as {
    result?: string;
    error?: { message?: string };
    message?: string;
  };

  if (result.error) {
    throw new EtherscanCallError(
      result.error.message ?? "Etherscan could not execute the read call.",
    );
  }

  if (!result.result?.startsWith("0x")) {
    throw new EtherscanError(
      result.message ?? "Etherscan could not execute the read call.",
    );
  }

  return result.result as Hex;
}
