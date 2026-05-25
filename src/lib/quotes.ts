import Decimal from "decimal.js";
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  parseAbi,
  parseUnits,
  type Hex,
} from "viem";
import type {
  PoolAnalysis,
  QuoteRequest,
  QuoteResult,
  SlippageSample,
  SwapDirection,
} from "./domain";
import { ethCall, EtherscanError } from "./etherscan";
import {
  calculatePriceImpactPct,
  executionPrice,
  feeTierPct,
  priceFromReserves,
  priceFromSqrtPriceX96,
} from "./math";
import { getEnabledChain } from "./registry";

export const V2_PAIR_ABI = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);

export const V3_POOL_ABI = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);

export const V3_QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

export const V4_STATE_VIEW_ABI = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);

export const V4_QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

type Call = (chainId: number, to: `0x${string}`, data: Hex) => Promise<Hex>;

interface QuoteOptions {
  call?: Call;
  wait?: () => Promise<void>;
  now?: () => Date;
}

export class QuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteError";
  }
}

const SAMPLE_FACTORS = ["0.25", "0.5", "1", "2", "4"];

function outputTokenDecimals(
  analysis: PoolAnalysis,
  direction: SwapDirection,
): number {
  return direction === "token0-to-token1"
    ? analysis.pair.token1.decimals
    : analysis.pair.token0.decimals;
}

function inputTokenDecimals(
  analysis: PoolAnalysis,
  direction: SwapDirection,
): number {
  return direction === "token0-to-token1"
    ? analysis.pair.token0.decimals
    : analysis.pair.token1.decimals;
}

function rawInput(
  amount: string,
  analysis: PoolAnalysis,
  direction: SwapDirection,
): bigint {
  return parseUnits(amount, inputTokenDecimals(analysis, direction));
}

function formattedOutput(
  raw: bigint,
  analysis: PoolAnalysis,
  direction: SwapDirection,
): string {
  return new Decimal(
    formatUnits(raw, outputTokenDecimals(analysis, direction)),
  ).toSignificantDigits(14).toString();
}

function sampleAmount(amountIn: string, factor: string): string {
  return new Decimal(amountIn).mul(factor).toSignificantDigits(14).toString();
}

async function readV2Reserves(analysis: PoolAnalysis, call: Call) {
  const encoded = encodeFunctionData({
    abi: V2_PAIR_ABI,
    functionName: "getReserves",
  });
  const result = await call(
    analysis.chain.chainId,
    analysis.identifier as `0x${string}`,
    encoded,
  );
  const [reserve0, reserve1] = decodeFunctionResult({
    abi: V2_PAIR_ABI,
    functionName: "getReserves",
    data: result,
  });
  return { reserve0, reserve1 };
}

function v2Output(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
): bigint {
  const amountInWithFee = amountIn * 997n;
  return (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);
}

async function quoteV2(
  request: QuoteRequest,
  call: Call,
  quotedAt: string,
): Promise<QuoteResult> {
  const { analysis, direction, amountIn } = request;
  const { reserve0, reserve1 } = await readV2Reserves(analysis, call);
  const spotPrice = priceFromReserves(
    reserve0,
    reserve1,
    analysis.pair.token0.decimals,
    analysis.pair.token1.decimals,
  );
  const reserveIn = direction === "token0-to-token1" ? reserve0 : reserve1;
  const reserveOut = direction === "token0-to-token1" ? reserve1 : reserve0;

  const quoteOne = (amount: string): SlippageSample => {
    const output = formattedOutput(
      v2Output(rawInput(amount, analysis, direction), reserveIn, reserveOut),
      analysis,
      direction,
    );
    return {
      amountIn: amount,
      amountOut: output,
      priceImpactPct: calculatePriceImpactPct(
        amount,
        output,
        spotPrice,
        direction,
      ),
    };
  };

  const exact = quoteOne(amountIn);
  return {
    status: "quoted",
    amountIn,
    amountOut: exact.amountOut,
    executionPrice: executionPrice(amountIn, exact.amountOut, direction),
    priceImpactPct: exact.priceImpactPct,
    feePct: feeTierPct(analysis.feeTier, analysis.dynamicFee),
    quotedAt,
    samples: SAMPLE_FACTORS.map((factor) =>
      quoteOne(sampleAmount(amountIn, factor)),
    ),
  };
}

async function concentratedSpotPrice(
  analysis: PoolAnalysis,
  call: Call,
): Promise<string> {
  if (analysis.version === "v3") {
    const result = await call(
      analysis.chain.chainId,
      analysis.identifier as `0x${string}`,
      encodeFunctionData({ abi: V3_POOL_ABI, functionName: "slot0" }),
    );
    const [sqrtPriceX96] = decodeFunctionResult({
      abi: V3_POOL_ABI,
      functionName: "slot0",
      data: result,
    });
    return priceFromSqrtPriceX96(
      sqrtPriceX96,
      analysis.pair.token0.decimals,
      analysis.pair.token1.decimals,
    );
  }

  const chain = getEnabledChain(analysis.chain.slug);
  if (!chain.contracts.v4StateView) {
    throw new QuoteError("No v4 state-view contract is configured for this network.");
  }
  const result = await call(
    analysis.chain.chainId,
    chain.contracts.v4StateView,
    encodeFunctionData({
      abi: V4_STATE_VIEW_ABI,
      functionName: "getSlot0",
      args: [analysis.identifier as Hex],
    }),
  );
  const [sqrtPriceX96] = decodeFunctionResult({
    abi: V4_STATE_VIEW_ABI,
    functionName: "getSlot0",
    data: result,
  });
  return priceFromSqrtPriceX96(
    sqrtPriceX96,
    analysis.pair.token0.decimals,
    analysis.pair.token1.decimals,
  );
}

async function quoteConcentratedAmount(
  request: QuoteRequest,
  amount: string,
  call: Call,
): Promise<string> {
  const { analysis, direction } = request;
  const chain = getEnabledChain(analysis.chain.slug);
  const amountRaw = rawInput(amount, analysis, direction);
  let rawOutput: bigint;

  if (analysis.version === "v3") {
    if (!chain.contracts.v3QuoterV2 || analysis.feeTier === null) {
      throw new QuoteError("No v3 quote contract is configured for this pool.");
    }
    const tokenIn =
      direction === "token0-to-token1"
        ? analysis.pair.token0.id
        : analysis.pair.token1.id;
    const tokenOut =
      direction === "token0-to-token1"
        ? analysis.pair.token1.id
        : analysis.pair.token0.id;
    const data = encodeFunctionData({
      abi: V3_QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: tokenIn as `0x${string}`,
          tokenOut: tokenOut as `0x${string}`,
          amountIn: amountRaw,
          fee: analysis.feeTier,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    const result = await call(analysis.chain.chainId, chain.contracts.v3QuoterV2, data);
    [rawOutput] = decodeFunctionResult({
      abi: V3_QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      data: result,
    });
  } else {
    if (
      !chain.contracts.v4Quoter ||
      analysis.feeTier === null ||
      analysis.tickSpacing === null
    ) {
      throw new QuoteError("No v4 quote contract is configured for this pool.");
    }
    const data = encodeFunctionData({
      abi: V4_QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: {
            currency0: analysis.pair.token0.id as `0x${string}`,
            currency1: analysis.pair.token1.id as `0x${string}`,
            fee: analysis.feeTier,
            tickSpacing: analysis.tickSpacing,
            hooks:
              (analysis.hookAddress ??
                "0x0000000000000000000000000000000000000000") as `0x${string}`,
          },
          zeroForOne: direction === "token0-to-token1",
          exactAmount: amountRaw,
          hookData: "0x",
        },
      ],
    });
    const result = await call(analysis.chain.chainId, chain.contracts.v4Quoter, data);
    [rawOutput] = decodeFunctionResult({
      abi: V4_QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      data: result,
    });
  }

  return formattedOutput(rawOutput, analysis, direction);
}

async function quoteConcentrated(
  request: QuoteRequest,
  call: Call,
  wait: () => Promise<void>,
  quotedAt: string,
): Promise<QuoteResult> {
  const spotPrice = await concentratedSpotPrice(request.analysis, call);
  await wait();
  const exactOutput = await quoteConcentratedAmount(request, request.amountIn, call);
  const samples: SlippageSample[] = [];

  for (const factor of SAMPLE_FACTORS) {
    const amount = sampleAmount(request.amountIn, factor);
    const amountOut =
      factor === "1"
        ? exactOutput
        : (await wait(), await quoteConcentratedAmount(request, amount, call));
    samples.push({
      amountIn: amount,
      amountOut,
      priceImpactPct: calculatePriceImpactPct(
        amount,
        amountOut,
        spotPrice,
        request.direction,
      ),
    });
  }

  return {
    status: "quoted",
    amountIn: request.amountIn,
    amountOut: exactOutput,
    executionPrice: executionPrice(
      request.amountIn,
      exactOutput,
      request.direction,
    ),
    priceImpactPct: calculatePriceImpactPct(
      request.amountIn,
      exactOutput,
      spotPrice,
      request.direction,
    ),
    feePct: feeTierPct(request.analysis.feeTier, request.analysis.dynamicFee),
    quotedAt,
    samples,
  };
}

export async function quotePool(
  request: QuoteRequest,
  options: QuoteOptions = {},
): Promise<QuoteResult> {
  const quotedAt = (options.now?.() ?? new Date()).toISOString();
  const call = options.call ?? ethCall;
  const wait =
    options.wait ??
    (() => new Promise<void>((resolve) => setTimeout(resolve, 360)));

  try {
    if (request.analysis.version === "v2") {
      return await quoteV2(request, call, quotedAt);
    }
    return await quoteConcentrated(request, call, wait, quotedAt);
  } catch (error) {
    if (request.analysis.version === "v4" && request.analysis.hookAddress) {
      return {
        status: "conditional",
        amountIn: request.amountIn,
        amountOut: null,
        executionPrice: null,
        priceImpactPct: null,
        feePct: feeTierPct(request.analysis.feeTier, request.analysis.dynamicFee),
        quotedAt,
        samples: [],
        warning:
          "This v4 pool uses a hook and its quote could not be simulated without hook-specific data.",
      };
    }

    if (error instanceof QuoteError || error instanceof EtherscanError) {
      throw error;
    }
    throw new QuoteError("Unable to quote this swap using current pool state.");
  }
}
