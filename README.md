# Pool Lens

Pool Lens is a Vercel-ready Uniswap liquidity and slippage analyzer. Paste a
pool URL to identify whether it is a v2, v3, or v4 pool, inspect liquidity
ranges, and obtain a read-only price-impact estimate for an exact-input swap.

![Pool Lens dashboard concept](https://img.shields.io/badge/interface-range--first-36e697?style=flat-square)

## What It Shows

- Protocol detection for Uniswap v2, v3 and v4 pool links.
- Token pair, fee tier, amounts, indexed TVL and current indexed price.
- Full-range reserve visualization for v2 pools.
- Active initialized liquidity bands for v3 and v4 pools.
- Dynamic-fee identification for v4 pools without presenting the fee flag as a fixed rate.
- A slippage curve generated from read-only current quote simulations.
- Exact typed swap output, execution price basis and price-impact percentage.
- Hook disclosure when a v4 quote is conditional or cannot be simulated safely.

The application analyzes and quotes; it does not connect wallets or submit
transactions.

## Supported Networks

| Network | State | Notes |
| --- | --- | --- |
| Ethereum Mainnet | Enabled | Configured for documented v2, v3 and v4 subgraphs and quote contracts. |
| Arbitrum One | Registry-ready | Remains hidden from successful analysis until per-version indexed endpoints are verified. |
| Polygon Mainnet | Registry-ready | Remains hidden from successful analysis until per-version indexed endpoints are verified. |

The network registry is intentionally conservative. A chain is not displayed
as supported until both onchain read access and indexed range data are
configured and validated.

## Local Setup

Requirements: Node.js 20 or later and npm.

```bash
npm install
cp .env.example .env.local
```

Set both server-only values in `.env.local`:

```dotenv
ETHERSCAN_API_KEY=your_etherscan_v2_key
THE_GRAPH_API_KEY=your_graph_gateway_key
```

Then run:

```bash
npm run dev
```

Open `http://localhost:3000` and paste a Uniswap explorer pool link, such as:

```text
https://app.uniswap.org/explore/pools/ethereum/0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4
```

## Deployment On Vercel

1. Import [gokhanseckin/uniswap-slippage](https://github.com/gokhanseckin/uniswap-slippage) into Vercel.
2. Add `ETHERSCAN_API_KEY` and `THE_GRAPH_API_KEY` as encrypted environment variables for Production and Preview.
3. Deploy the Next.js project with the default build command, `npm run build`.

Keys remain in server route handlers; browser code never receives them.

## Data Flow

- `POST /api/analyze` validates the Uniswap URL, selects the enabled chain,
  identifies the protocol version through configured The Graph subgraphs, and
  normalizes reserves or initialized bands into one dashboard response.
- `POST /api/quote` repeats trusted pool resolution, then uses Etherscan API
  V2 `eth_call` to read live reserve/state and call the configured v3/v4
  quoter for the requested direction and amount.
- The quote curve samples requests sequentially to remain compatible with the
  Etherscan free-plan rate limit.

Indexed liquidity can lag current chain state. Quote output is read-only
simulation, not a transaction guarantee. A v4 hook may require data or
execution behavior that cannot be represented by a generic quote; the UI
reports that case rather than displaying a misleading percentage.
V4 dynamic-fee pools are labeled `Dynamic`; their live quote still reflects
the contract path without claiming a fixed fee percentage.

## Validation

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The automated suite covers URL validation, network gating, indexed v2/v3/v4
normalization, exact-input quote math and transport, API failures, and the
interactive range-first dashboard.

## Reference Sources

- [Etherscan V2 supported chains](https://docs.etherscan.io/supported-chains)
- [Etherscan `eth_call` endpoint](https://docs.etherscan.io/api-reference/endpoint/ethcall)
- [Uniswap subgraph overview](https://developers.uniswap.org/docs/ecosystem/subgraphs/overview)
- [Uniswap v3 Ethereum deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments)
- [Uniswap v4 deployments](https://developers.uniswap.org/docs/protocols/v4/deployments)
- [Uniswap v4 quoter interface](https://github.com/Uniswap/v4-periphery/blob/main/src/interfaces/IV4Quoter.sol)
