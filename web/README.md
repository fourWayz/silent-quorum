# Silent Quorum — Frontend

The frontend/demo milestone for Silent Quorum. The protocol itself (Quorum
Core, Quorum Registry, Consequence Claim Ledger) is frozen as of Milestone
2 — see the repository root [README.md](../README.md) and
[ARCHITECTURE.md](../ARCHITECTURE.md). Nothing here changes contract
semantics; this app is a consumer of the compiled contracts, nothing more.

## Running it

From the repository root (this is an npm workspace):

```sh
npm install
npm run --workspace=contract compact   # compiles the three .compact contracts
npm run --workspace=contract build     # compiles contract/src to contract/dist for the web app to import
npm run --workspace=web dev
```

Then open `http://localhost:3000`.

## What's actually connected

This app is explicit about its data source everywhere — see the
environment badge on every protocol-data page:

- **Demo · Simulator** (default, and what the interactive
  Console/Registry/Claims pages run against): every pledge, registration,
  and claim runs the real compiled Compact circuits from `contract/dist`
  — the exact contracts audited in Milestone 2 — executed server-side
  (Next.js Server Actions, Node runtime) against an in-memory ledger
  seeded once per server process. It is not a mock of the protocol; it is
  the protocol, without a network underneath it. State resets on server
  restart — a disclosed limitation of a single-process demo, not a
  database.
- **Live · Midnight Preprod** (`/live`, badge reads exactly "Live ·
  Midnight Preprod"): reads the three real contracts deployed to Midnight
  Preprod directly from the live indexer
  (`indexerPublicDataProvider` → `queryContractState`), decoded with the
  exact same compiled `ledger()` functions the simulator uses — the same
  decode path, fed real fetched state instead of local simulator state.
  Nothing on that page is fabricated or backfilled from the simulator. It
  is strictly **read-only**: no wallet is involved and no transaction can
  be submitted from the browser. The three deployed addresses live in one
  place, `src/lib/protocol/preprod-config.ts`, overridable via
  `MIDNIGHT_NETWORK`, `MIDNIGHT_INDEXER_URL`, `MIDNIGHT_INDEXER_WS_URL`,
  `MIDNIGHT_NODE_URL`, `MIDNIGHT_CORE_ADDRESS`, `MIDNIGHT_REGISTRY_ADDRESS`,
  and `MIDNIGHT_CLAIM_LEDGER_ADDRESS` env vars (all public addresses, not
  secrets — see the repository root's
  [PREPROD_DEPLOYMENT.md](../PREPROD_DEPLOYMENT.md) for how they were
  deployed and independently verified). If any read fails, the affected
  section shows an explicit "Unavailable" panel instead of silently
  falling back to simulator data.
  - **No write path from the browser, on purpose.** Submitting a real
    Preprod transaction needs a wallet that has completed its DUST sync —
    empirically 3-5 hours per fresh process against Preprod (see
    `PREPROD_DEPLOYMENT.md`'s "Problems Encountered"). That is
    fundamentally incompatible with a web request/response cycle, and a
    long-lived warm wallet singleton was judged not worth the
    credential-handling risk for this milestone. Rather than fake a
    transaction animation, the Preprod view stays read-only and says so.
- **Local Devnet**: the footer's connectivity line
  (`lib/protocol/environment.ts`) makes a real GraphQL request to a local
  Midnight indexer (default `http://127.0.0.1:18088`) and reports the
  actual block height if one is reachable — never a fabricated number. As
  of this milestone, that connection is read-only (a genuine reachability
  and block-height check); the interactive pledge/claim flows do not yet
  submit real devnet transactions from the web app. `devnet-test/` in the
  repository root remains the source of truth for live-devnet evidence
  (see ARCHITECTURE.md's "Live-devnet results").
- **Demo Mode**: labeled in `lib/protocol/environment-copy.ts` for a
  scripted walkthrough; not wired to an autoplay sequence in this
  milestone (see Known Limitations below) — today the same honest label
  set covers Simulator, Local Devnet, and Unconfigured.

No screen in this app fabricates a transaction hash, a wallet address, or
a "live" number. Where a real integration doesn't exist, the UI says so.

## Architecture

```
src/
  app/                    Next.js App Router pages
    live/                 Read-only Live · Midnight Preprod page
  components/
    hero/                 3D Quorum Field (React Three Fiber) + hero copy
    quorum/                Console: threshold visualization, pledge ritual,
                           ignition overlay, state machine diagram
    registry/, claims/     The other two protocol surfaces
    architecture/          Interactive architecture diagram
    protocol/               Six-step mechanism explainer
    environment/            Environment badges + real devnet status
    ui/, layout/            Design-system primitives
  lib/
    protocol/
      types.ts             Shared protocol-facing types (no rendering, no I/O)
      environment.ts        Real devnet connectivity probe (server-only)
      preprod-config.ts      The one authoritative place holding the three
                             deployed Preprod contract addresses + network
                             endpoints (env-var overridable)
      engine/                The only code that touches the compiled
                             simulators directly — store.ts (in-memory
                             state), seed.ts (demo quorums), quorum.ts /
                             registry.ts / claims.ts (typed read/write
                             functions used by Server Actions), and
                             preprod.ts (real, read-only Midnight Preprod
                             indexer integration — server-only)
      actions.ts            "use server" boundary the client components call
      identity.ts            Client-side identity-secret generation/storage
      content.ts              Static copy shared between pages
    hooks/                  useReducedMotion (useSyncExternalStore-based)
    utils.ts                 cn(), hex formatting, error-message helper
```

Presentation, protocol data, and environment/integration logic are kept in
separate layers on purpose (per the milestone brief) — no component reaches
into a compiled contract directly; everything goes through
`lib/protocol/engine`.

## Why `contract/dist` and not `contract/src`

The compiled Compact contracts (`contract/src/*/managed/`) are plain JS +
declarations, but the hand-written simulator/witness/domain TypeScript
files use `.js`-extension relative imports (the Node ESM convention the
existing test suite already relies on). Next's bundler doesn't resolve a
`.js` specifier to a sibling `.ts` file the way `tsc`'s own module
resolution does, so the web app imports a real, compiled `contract/dist`
(via `contract/package.json`'s new `build` script) instead of fighting
that bundler/Node-ESM mismatch. `contract/dist` is a build artifact
(gitignored, matching the existing `managed/` convention) — it changes
nothing about the audited contract source, only how the frontend consumes
it.

## Known limitations

- **State is in-memory and single-process.** Restarting the dev/production
  server resets every simulated quorum, registry entry, and claim back to
  its seed state. Fine for a demo; not a real backend.
- **No wallet integration yet.** The "Local Devnet" status check is a real
  connectivity probe, not a transaction path. Wiring the pledge/claim
  rituals to genuinely submit transactions against a live devnet (reusing
  `devnet-test/src/shared.ts`'s wallet/provider patterns) is future work,
  not attempted here to keep this milestone's scope to the frontend
  experience the brief asked for.
- **`/live` is read-only, by design, not by omission.** It reads the real
  Preprod deployment directly from the indexer but cannot submit
  transactions — see "No write path from the browser" above. Pledging,
  registering, and claiming only work in the Simulator.
- **Preprod participant count is a proxy, not a direct read.** Quorum
  Core's `eligibility_tree` exposes no direct leaf-count accessor, so
  `/live` shows `tally` as an honest lower bound on registered
  participants (every pledge implies a prior registration), not a
  separately-verified count.
- **`/live` shows one deployed quorum.** The Preprod deployment evidence
  in `PREPROD_DEPLOYMENT.md` covers the single flagship Core/Registry/Claim
  Ledger instance actually deployed — it is not a multi-quorum showcase
  the way the Simulator's Console page is.
- **No dedicated Demo Mode autoplay.** The environment vocabulary
  (Simulator / Demo Mode / Local Devnet / Unconfigured) is fully defined,
  but only Simulator and the real devnet status check are exercised in
  this build.
- **No dedicated `/about` route.** Its content was folded into the
  homepage and `/protocol` page rather than given its own page, to keep
  navigation to the five items actually built.
- Visual QA in this environment was verified through the compiled CSS
  output, full HTML responses, and a clean production build/typecheck/lint
  — not through an actual rendered-browser screenshot pass (Playwright's
  browser download was blocked by this sandbox's network egress rules).
