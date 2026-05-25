# Uniswap Slippage Analyzer Design

## Purpose

Build a Vercel-deployed web page where a user pastes a Uniswap pool URL, sees
whether the pool uses v2, v3, or v4, explores its liquidity distribution and
estimated slippage curve, and enters a swap amount to receive a percentage
price-impact estimate.

The product is an analysis tool. It does not connect a wallet, submit swaps,
or promise executable trade prices.

## Confirmed User Experience

The selected interface is a range-first research view:

1. A top input accepts a Uniswap pool URL, for example
   `https://app.uniswap.org/explore/pools/ethereum/0x5c6165e63581876edc7413bbc18e53b733f86dda709b1e9acf171fa15b0fa7a4`.
2. A summary panel shows network, protocol version, token pair, fee or hook
   status, current price, token amounts, TVL when supplied by indexed data,
   and data freshness.
3. The principal chart visualizes liquidity bands or ranges. The active
   range is highlighted.
4. A second chart visualizes estimated price impact as swap size increases.
5. A compact swap strip allows token direction selection and an exact input
   amount, then shows estimated output, execution price, fee, and slippage
   percentage.

The analyzed pool URL remains in page state and is shareable through query
parameters after analysis.

## Supported Protocol Behavior

### Version Detection

The server parses the Uniswap URL into a configured chain slug and pool
identifier, then queries the configured subgraphs by identifier:

- v2 and v3 pool identifiers are contract addresses.
- v4 pool identifiers are `bytes32` pool IDs, such as the provided Ethereum
  example.
- Identifier length helps route candidate lookups, but a successful indexed
  pool lookup is the version confirmation.

### Liquidity Display

- **v2**: display pool token reserves and a constant-product liquidity curve;
  label the liquidity as full range.
- **v3**: query initialized ticks and display net liquidity across price
  ranges, highlighting the range containing the current tick.
- **v4**: query indexed pool and tick/range state, highlight the active
  range, and disclose hooks or dynamic-fee configuration when available.

### Quote And Slippage Behavior

For a user-entered exact-input amount, the server attempts a current,
read-only quote using the configured Uniswap contract address on the
selected network through Etherscan API V2 `eth_call`.

- v2 quotes use current pool/router read behavior or reserve math with the
  known protocol fee when an appropriate read-only quote path is configured.
- v3 quotes use the network's configured quoter contract.
- v4 quotes use the network's configured quoter contract and pool key derived
  from indexed metadata.
- If a v4 hook, dynamic fee behavior, or quoter response cannot be modeled or
  decoded reliably, the app marks the calculation as unavailable or
  conditional instead of presenting a misleading percentage.

The slippage percentage is displayed as price impact relative to the current
mid-price, with protocol fee displayed separately when it is known.
The curve is formed from a bounded set of quote sizes around available
liquidity and respects Etherscan rate limits.

## Data Sources

The application uses a hybrid server-side model:

- **The Graph gateway** supplies indexed pool discovery, token metadata,
  amounts, TVL, current tick/state, and initialized range data needed for
  efficient v3/v4 visualizations.
- **Etherscan API V2** supplies read-only `eth_call` access for current
  contract state or quote simulations on configured supported chains.

Neither key is exposed to browser code. The Graph values are labeled as
indexed data; on-chain quote responses are labeled with their retrieval time
and block information when returned by the selected call path.

## Network Registry

The app uses a configuration registry rather than promising every Etherscan
network automatically. A network is visible as supported only when it has:

1. Etherscan free-tier access for its chain ID.
2. Verified Uniswap protocol deployment addresses required for enabled
   versions.
3. Configured The Graph subgraph IDs whose indexing status and expected
   schema have been validated.

The first registry covers:

| Network | Chain ID | Initial Status | Rationale |
| --- | ---: | --- | --- |
| Ethereum Mainnet | 1 | Enabled at launch | Etherscan free-tier access and documented Uniswap v2, v3, and v4 public subgraph examples are available. |
| Arbitrum One | 42161 | Configurable after subgraph validation | Etherscan free-tier and Uniswap v4 deployments are documented; active per-version subgraph IDs must be selected and verified before exposing analytics. |
| Polygon Mainnet | 137 | Configurable after subgraph validation | Etherscan free-tier and Uniswap v4 deployments are documented; active per-version subgraph IDs must be selected and verified before exposing analytics. |

This registry structure permits later addition of further Etherscan-accessible
networks without weakening the displayed-data guarantee.

## Application Architecture

The app is built with Next.js App Router and deployed on Vercel.

### Page And Components

- The server-rendered landing page supplies product framing and configured
  network availability.
- A client-side analyzer panel manages URL entry, selected swap direction and
  amount, chart interaction, loading states, and shareable URL query state.
- Responsive charts render liquidity bands and slippage samples without
  leaking service credentials.

### Server API

- `POST /api/analyze` validates a pool URL, resolves its supported network and
  protocol version, fetches indexed pool/range information, and returns a
  normalized analysis payload.
- `POST /api/quote` validates a previously resolved pool plus exact-input
  request, performs rate-limited read-only quote calls, and returns the
  output/impact result or a precise unsupported explanation.

Network and protocol adapters isolate v2, v3, and v4 query/schema differences
behind common normalized response types.

### Caching And Limits

- Static deployment and subgraph registry data can be cached in application
  code.
- Indexed analysis requests use short Vercel/server caching appropriate to
  analytics.
- Quote requests are treated as time-sensitive, are not long-cached, and
  restrict curve sampling concurrency to remain within Etherscan free-tier
  rate limits.

## States And Errors

The UI includes designed states for:

- Empty input with the example URL available to try.
- Loading analysis and loading quote/curve independently.
- Malformed Uniswap URL or unsupported URL path.
- Network not enabled in the registry.
- Pool not found in configured v2/v3/v4 indexes.
- Missing server environment keys or upstream service failures.
- Etherscan rate limiting.
- Stale or not-yet-indexed subgraph data.
- v4 hook or dynamic-fee quote behavior that cannot be represented reliably.

No failure silently becomes a zero-liquidity or zero-slippage result.

## Security And Deployment

The Vercel project requires server-only environment variables:

- `ETHERSCAN_API_KEY`
- `THE_GRAPH_API_KEY`

Optional registry values for validated non-Ethereum subgraph IDs may be stored
as server-only configuration or environment variables. Values are not sent to
the browser, written to logs, or committed to GitHub.

The implementation is versioned in
`https://github.com/gokhanseckin/uniswap-slippage`, with meaningful commits
and a pushed deployable branch. Vercel can deploy from the GitHub repository
after environment variables are supplied.

## Testing And Acceptance

Automated tests cover:

- URL parsing for valid Ethereum pool links, malformed URLs, unsupported
  chain slugs, v2/v3 address identifiers, and v4 pool IDs.
- Registry gating and protocol-version resolution.
- Normalization of representative v2, v3, and v4 indexed responses.
- Slippage percentage calculation, direction switching, decimal formatting,
  and conditional quote failures.
- API route validation and upstream error responses.
- Dashboard rendering for empty, loading, success, and error states.

Before delivery, the application must pass its test suite and production
build, and the range-first view must be checked in a browser at desktop and
mobile widths using a representative configured pool.

## Sources Consulted

- Etherscan supported chains and free-tier coverage:
  <https://docs.etherscan.io/supported-chains>
- Etherscan API V2 `eth_call`:
  <https://docs.etherscan.io/api-reference/endpoint/ethcall>
- Uniswap v4 deployment addresses:
  <https://developers.uniswap.org/docs/protocols/v4/deployments>
- Uniswap subgraphs overview and documented Ethereum endpoint examples:
  <https://developers.uniswap.org/docs/ecosystem/subgraphs/overview>
