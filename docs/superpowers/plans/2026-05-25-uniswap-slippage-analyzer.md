# Uniswap Slippage Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Vercel-ready dashboard that resolves an Ethereum Uniswap v2/v3/v4 pool URL, visualizes its liquidity distribution, and quotes price impact for a typed exact-input swap.

**Architecture:** A Next.js App Router page renders a range-first interactive dashboard. Server route handlers call The Graph for normalized pool/range analysis and Etherscan `eth_call` for current quote reads; protocol-specific functions return shared domain types to the UI. Ethereum is enabled immediately, with Arbitrum and Polygon represented as disabled registry entries until their subgraph IDs are validated.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Vitest, Testing Library, `viem`, `decimal.js`, Vercel, The Graph gateway, Etherscan API V2.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `package.json`, framework configs | App scripts, Next.js/TypeScript/Tailwind/Vitest setup. |
| `.env.example` | Document required server-only service keys. |
| `src/app/page.tsx`, `layout.tsx`, `globals.css` | Page shell, metadata, and visual system. |
| `src/components/analyzer-dashboard.tsx` | Interactive URL/quote workflow and states. |
| `src/components/liquidity-chart.tsx`, `slippage-chart.tsx` | Accessible SVG analytics graphics. |
| `src/lib/domain.ts` | Normalized request/response and chart types. |
| `src/lib/registry.ts` | Supported chain and contract/subgraph configuration. |
| `src/lib/pool-url.ts` | Trusted Uniswap URL parsing and validation. |
| `src/lib/math.ts` | Spot price, fee display, and percentage-impact math. |
| `src/lib/graph.ts` | Keyed Graph gateway fetch wrapper and per-version indexed normalization. |
| `src/lib/etherscan.ts` | Keyed `eth_call` wrapper and ABI-encoded read helper. |
| `src/lib/quotes.ts` | v2 reserve quote, v3 quoter, and v4 quoter/state-view adapters. |
| `src/app/api/analyze/route.ts` | Validated analysis endpoint. |
| `src/app/api/quote/route.ts` | Validated current quote/curve endpoint. |
| `src/**/*.test.ts(x)` | Behavior-first tests for parser, math, services, routes, and UI. |

### Task 1: Bootstrap The Tested Web Application

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `src/test/setup.ts`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `src/app/page.test.tsx`

- [ ] **Step 1: Create test and framework configuration**

Configure `npm run test` with Vitest/jsdom and write a landing-page test that expects the heading `Map liquidity. Measure impact.` and a URL input labelled `Uniswap pool URL`.

- [ ] **Step 2: Run the landing-page test to verify RED**

Run: `npm test -- src/app/page.test.tsx`

Expected: FAIL because the application page and dashboard do not exist.

- [ ] **Step 3: Implement the minimal App Router shell**

Create a Next.js page rendering `<AnalyzerDashboard />`, metadata, fonts and the dark range-first visual foundation. Add `.env.example` containing:

```dotenv
ETHERSCAN_API_KEY=
THE_GRAPH_API_KEY=
```

- [ ] **Step 4: Run the landing-page test to verify GREEN**

Run: `npm test -- src/app/page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts .env.example src
git commit -m "feat: scaffold slippage analyzer interface"
```

### Task 2: Parse Pool Links And Gate Networks

**Files:**
- Create: `src/lib/domain.ts`, `src/lib/registry.ts`, `src/lib/pool-url.ts`
- Test: `src/lib/pool-url.test.ts`, `src/lib/registry.test.ts`

- [ ] **Step 1: Write parser and registry tests**

Cover the supplied v4 link, an Ethereum address-shaped v2/v3 candidate, invalid hosts/paths, unsupported chain slugs, and disabled Arbitrum/Polygon entries. Required API:

```ts
export function parsePoolUrl(raw: string): ParsedPoolUrl
export function getEnabledChain(slug: string): ChainConfig
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/lib/pool-url.test.ts src/lib/registry.test.ts`

Expected: FAIL because the parsing and registry modules are missing.

- [ ] **Step 3: Implement parsing and registry**

Use `URL`, lowercase identifiers, strict `app.uniswap.org/explore/pools/<chain>/<id>` matching, `0x` address/bytes32 validation, and registry entries for Ethereum (`enabled: true`), Arbitrum One and Polygon (`enabled: false`). Configure Ethereum v2/v3/v4 subgraph IDs and official v3/v4 quote/state-view addresses.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/lib/pool-url.test.ts src/lib/registry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib
git commit -m "feat: validate uniswap pool urls and networks"
```

### Task 3: Normalize Indexed Pool And Liquidity Data

**Files:**
- Create: `src/lib/graph.ts`, `src/app/api/analyze/route.ts`
- Test: `src/lib/graph.test.ts`, `src/app/api/analyze/route.test.ts`

- [ ] **Step 1: Write failing indexed-data tests**

Use injected/mock `fetch` responses for v2 pair reserves, v3 pool/ticks, and v4 pool/ticks including hooks. Tests require common output:

```ts
type PoolAnalysis = {
  version: "v2" | "v3" | "v4";
  pair: TokenPair;
  currentTick: number | null;
  liquidityBands: LiquidityBand[];
  hookAddress: string | null;
};
```

The route must return `400` for invalid URLs, `422` for disabled chains, and a normalized success payload for configured indexed data.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/lib/graph.test.ts src/app/api/analyze/route.test.ts`

Expected: FAIL because Graph lookup and the endpoint are absent.

- [ ] **Step 3: Implement Graph adapters and endpoint**

Create a server-only gateway fetcher using `THE_GRAPH_API_KEY`; query a v4 bytes32 ID directly, or try v3 then v2 for an address ID. Normalize reserves as one full-range v2 band and ticks as v3/v4 price ranges; include upstream error codes and indexed retrieval timestamp.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/lib/graph.test.ts src/app/api/analyze/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph.ts src/app/api/analyze src/lib/domain.ts
git commit -m "feat: analyze indexed uniswap pool liquidity"
```

### Task 4: Quote Exact Inputs And Calculate Price Impact

**Files:**
- Create: `src/lib/math.ts`, `src/lib/etherscan.ts`, `src/lib/quotes.ts`, `src/app/api/quote/route.ts`
- Test: `src/lib/math.test.ts`, `src/lib/quotes.test.ts`, `src/app/api/quote/route.test.ts`

- [ ] **Step 1: Write failing quote tests**

Test impact math independently and stub Etherscan results for:

```ts
export async function quotePool(request: QuoteRequest): Promise<QuoteResult>
```

Require v2 reserve constant-product output, encoded v3/v4 read calls, sample curve ordering, and a conditional/unsupported result for v4 quote errors with hooks.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/lib/math.test.ts src/lib/quotes.test.ts src/app/api/quote/route.test.ts`

Expected: FAIL because math and quote modules are missing.

- [ ] **Step 3: Implement exact-input quoting**

Use `decimal.js` for display math and `viem` for ABI encoding/decoding. The Etherscan wrapper calls `module=proxy&action=eth_call&tag=latest` with `ETHERSCAN_API_KEY`. Read current v2 reserves, v3 `slot0` plus `QuoterV2.quoteExactInputSingle`, or v4 `StateView.getSlot0` plus `Quoter.quoteExactInputSingle`; throttle multiple samples so a curve request respects the free rate limit.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/lib/math.test.ts src/lib/quotes.test.ts src/app/api/quote/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/app/api/quote
git commit -m "feat: quote swaps and compute price impact"
```

### Task 5: Complete The Range-First Dashboard

**Files:**
- Create: `src/components/analyzer-dashboard.tsx`, `src/components/liquidity-chart.tsx`, `src/components/slippage-chart.tsx`
- Modify: `src/app/page.tsx`, `src/app/globals.css`
- Test: `src/components/analyzer-dashboard.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Render the dashboard with mocked API responses, submit the sample URL, and require version/pair/amount cards, liquidity chart label, swap amount submission, output amount, and `Price impact` result. Cover API error text for an unavailable quote.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/components/analyzer-dashboard.test.tsx`

Expected: FAIL until the full dashboard behavior is present.

- [ ] **Step 3: Implement the approved layout**

Build the selected range-first view: URL hero/input, version badge, metrics, dominant liquidity band SVG, secondary price-impact SVG, token-direction toggle, amount input, quote metrics, disclosure and designed empty/loading/error states. Store the analyzed link as `?pool=<encoded-url>`.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/components/analyzer-dashboard.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components src/app
git commit -m "feat: deliver range-first pool dashboard"
```

### Task 6: Document, Verify, And Publish

**Files:**
- Create: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Document setup and safety constraints**

Write setup, Vercel environment variable configuration, enabled-network status, supported pool URL format, v4 hook caveat, and source links in `README.md`.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 3: Browser-verify the product flow**

Run the local application, open it in the in-app browser, and verify desktop and narrow/mobile layouts plus empty/error behavior and a mocked or key-backed successful response.

- [ ] **Step 4: Commit documentation and verification-ready state**

```bash
git add README.md .gitignore
git commit -m "docs: document deployment and data sources"
git push origin main
```

- [ ] **Step 5: Prepare Vercel delivery**

Ensure the pushed GitHub repository can be imported by Vercel. Live analysis becomes active once `ETHERSCAN_API_KEY` and `THE_GRAPH_API_KEY` are configured as server-side environment variables in the Vercel project.
