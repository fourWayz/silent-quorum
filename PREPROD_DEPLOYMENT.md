# Silent Quorum — Preprod Deployment Evidence

All three Silent Quorum contracts — Quorum Core, Quorum Registry, and
Consequence Claim Ledger — are deployed to the real Midnight **Preprod**
network, independently confirmed reachable through the live Preprod
indexer, and each has been exercised with real transactions against its
actual on-chain invariants. No contract source, circuit, or protocol
semantics were changed to make any of this work.

**Verdict: FULL PREPROD DEPLOYMENT VERIFIED**

## Network

| | |
|---|---|
| Network | Preprod (`networkId: "preprod"`) |
| Node RPC | `https://rpc.preprod.midnight.network` |
| Indexer | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| Block height at final verification | 2,566,273 |
| Proof server | local, `midnightntwrk/proof-server:8.1.0`, `http://127.0.0.1:16300` |

Preview (the network used prior to Preprod) was confirmed retired before
this work began — its indexer returns a static, non-advancing block
height — so Preprod is the correct current target, not an assumption.

## Compatibility

| Component | Version |
|---|---|
| Compact compiler | 0.31.1 |
| Compact language | 0.23.0 |
| compact-runtime | 0.16.0 |
| Ledger | ledger-v8 (8.0.2) |
| `@midnight-ntwrk/midnight-js-*` | 4.1.1 |

This exact triple (compactc 0.31.1 / compact-runtime 0.16.0 / midnight.js
4.1.1) is the one the official Midnight support matrix lists as tested
and supported for both Preprod and Mainnet — matched exactly, not
inferred. No toolchain upgrade was made or needed.

## Deployed Contracts

| Contract | Address | Deployment tx | Deployed at (UTC) |
|---|---|---|---|
| Quorum Core | `8e9eec2f11b807074b65b3a595df6e46c22f897f8c4cd92db446c514c50968a1` | (see note below) | 2026-09-14T19:00:10.453Z |
| Quorum Registry | `a7d9fdf9fb056b275b8724ada9127bdbb97255186d807546807d637ac5d2bfd8` | `90e23a3401c37ff3e154aa9f182169a4623a28b5c61fa126cf3a8ffb70e5590c` | 2026-09-15T16:06:20.070Z |
| Consequence Claim Ledger | `8f02f4d7a7c284e09581334c141e9d1f138807b9b0f9e3d1bce2c5d7b77703ca` | `406731921d395515beb6fca881313d706ceaa9debcf5ae42be8b55b55e160e37` | 2026-09-15T21:46:27.936Z |

Core's own deploy transaction identifier was not captured by the
deployment script at the time (the field it read was empty); every
subsequent Core call (register, pledge, etc. — see below) has a real,
recorded transaction hash, and the address itself is independently
confirmed live via the indexer, so this is a documentation gap in what
was captured, not a gap in the deployment's authenticity.

### Configuration used

Core (threshold deliberately small — 2 — to keep real fee/time cost
bounded for a single-wallet, single-session deployment while still
genuinely exercising every state transition):

| Field | Value |
|---|---|
| org | `org:silent-quorum-preprod` |
| quorum | `quorum:flagship-2026` |
| action | `action:ignite` |
| threshold | 2 |
| issuer commitment | `issuerCommitmentFor(secretFor("preprod-issuer"))` |
| recipient commitment | `recipient:preprod-escrow` |
| consequence amount | 5,000 |
| protocol version | 2 |

Registry: `operatorCommitmentFor(secretFor("preprod-operator"))`.

Claim Ledger: `arbiterCommitmentFor(secretFor("preprod-arbiter"))`.

All identity/role secrets are deterministic test values derived the same
way as every other secret in this codebase (`secretFor(label)` —
`domain.ts`'s `b32`), scoped to this Preprod deployment only. The actual
funding wallet's mnemonic is a separately generated, real 24-word BIP39
mnemonic, held only in the gitignored `devnet-test/.env.preprod` — never
committed, never printed to a log or terminal transcript.

## Independent Verification

Each address was queried directly against the live Preprod indexer
(`contractAction(address: ...)`), separately from and after the
deployment script's own process exited — not inferred from the script's
return value. All three resolved successfully in one consolidated check
at block height 2,566,273:

```
Core:         {"data":{"contractAction":{"address":"8e9eec2f...968a1"}}}
Registry:     {"data":{"contractAction":{"address":"a7d9fdf9...2bfd8"}}}
ClaimLedger:  {"data":{"contractAction":{"address":"8f02f4d7...703ca"}}}
```

Core's raw on-chain state was additionally decoded earlier and found to
contain its actual configuration labels and circuit names in plain view
in the hex payload — `org:silent-quorum-preprod`, `quorum:flagship-2026`,
`action:ignite`, `recipient:preprod-escrow`, `register`, `pledge`,
`close_registration`, `cancel` — direct evidence the deployed contract is
genuinely Silent Quorum's Core, not just a reachable address.

## Real Validation

Every check below is a real transaction submitted to and accepted (or
correctly rejected) by the live Preprod network — not a simulator run,
not a unit test. Rejections are reported with the contract's own exact
assertion message, confirming the real deployed circuit's actual guard
fired, not a client-side approximation of one.

### Quorum Core (6/6 PASS)

| Check | Result | Evidence |
|---|---|---|
| register p1 | PASS | tx recorded |
| register p2 | PASS | `2e835ade926b56c17546c33ecd772b62d7dc8009c3b802f08ea4377115ec1a69` |
| pledge p1 (below threshold) | PASS | `e0c0823ef3024e94bfe7420cd6afee53ecd45fe8dc503b5e30daf83a596f4736` |
| pledge p2 (crosses threshold, fires) | PASS | `e2b2b3a4ab494a167210a3d69b0d288d002c15cd2c428578d2ad8628c945aebc` |
| replay p1 pledge (must be rejected) | PASS | rejected: `already pledged` — the real nullifier-reuse guard |
| close_registration | PASS | `22c2e7c93e0747f56acda11110c79bc9ef1ee8e72ab7e636ddcc554891cc0235` |

The replay check specifically confirms the rejection reason, not just
that *something* failed — an earlier fast-path run of this same check
produced a **false pass** (both registrations had silently failed due to
the wallet-sync issue described below, so the replay attempt failed for
the wrong reason — no eligibility commitment at all, not nullifier
reuse). That run's result was discarded and is not represented here; only
this corrected, patient-wallet run's results are.

### Quorum Registry (4/4 PASS)

| Check | Result | Evidence |
|---|---|---|
| A. register_quorum (real Core instance) | PASS | `46efb4e9224269a23e4535442f2e62174e1d6fe81c7d85beab767d7385391ca3` |
| B. duplicate register_quorum (must be rejected) | PASS | rejected: `quorum already registered` |
| D. unauthorized register_quorum (must be rejected) | PASS | rejected: `not authorized operator` |
| C. deactivate_quorum (real Core instance) | PASS | `3de08333dbaa8f3f745cc46356f3b3052c489de05f42e8af2c3cd38c4c72188f` |

Registry's `register_quorum` call used the real deployed Core address
(converted to raw bytes via the platform SDK's `ContractAddress.asBytes`)
and Core's real `config_commitment`, recomputed client-side from Core's
actual constructor arguments — the protocol's own documented design for
independent reproducibility (see root `README.md`), not a value read back
from chain. Registry has no mechanism to read Core's state directly (no
cross-contract reads in this toolchain), so this is exactly the trust
boundary the architecture already documents, exercised for real.

### Consequence Claim Ledger (4/4 PASS)

| Check | Result | Evidence |
|---|---|---|
| A. claim (real recipient secret) | PASS | `54fe1f2e3fe37a7ba17804ae52486915584c508f19e2af47432178e431c8a6a5` |
| B. duplicate claim (must be rejected) | PASS | rejected: `already claimed` |
| C. wrong recipient secret (must be rejected) | PASS | rejected: `not the named recipient` |
| D. dispute (real arbiter secret) | PASS | `be1f2114a9df3498b28628a9193fd4a76468fe675e1575076f91d2b141ed75d4` |

The real claim references Core's actual `(org, quorum, action)` triple —
the same one that genuinely fired on-chain (see Core's pledge p2 above).
This is a coherent, honest example: the referenced quorum really did
fire, but the Claim Ledger has no way to check that and did not check it
— it only proved the caller controlled the recipient secret. The
protocol's trust boundary (documented since Milestone 2: the Claim Ledger
cannot and does not establish that Core fired) is preserved exactly, not
worked around.

## Concurrency

No new concurrency testing was performed for Registry or Claim Ledger.
Duplicate-registration and duplicate-claim rejection were proven via
real, sequential transactions against the live network (checks B above,
both contracts) — sufficient to establish the invariant itself. A true
two-OS-process race (the methodology already used for Core's
pledge-vs-pledge and cancel-vs-pledge races in Milestone 2) was not
attempted here: each patient wallet sync alone took multiple hours, and
Core's live-network concurrency behavior is already established and
documented in `ARCHITECTURE.md`. Repeating that methodology for Registry
and Claim Ledger was judged not worth the additional multi-hour cost per
contract, per explicit instruction to prioritize correctness over
exhaustive re-proof of already-established concurrency properties.

## Problems Encountered

Documented in full so the real path here — including the parts that
didn't work — is visible, not smoothed over.

- **Root cause of the multi-hour delays: wallet DUST-sync, not DUST
  generation rate.** The first hypothesis (DUST accrues over
  roughly a week per Midnight's own tokenomics, so "just wait") was
  wrong, or at least not the operative constraint here. The actual cause:
  a freshly-built wallet process cannot correctly see an existing DUST
  balance — even a large, already-materialized one — until its own dust
  sub-wallet finishes syncing, and there is no snapshot/state-persistence
  wired into this tooling, so **every fresh process pays that sync cost
  again from a cold start.** Confirmed directly: a "fast path" wallet
  (waiting only on the cheap unshielded sync) reached
  `Wallet.InsufficientFunds` in seconds against a wallet that had, in a
  different process moments earlier, just successfully paid for a real
  deployment — proving the funds existed and were simply not visible yet
  to the new process.
- **First DUST-registration attempts failed with a real, diagnosable
  error**: `Custom error 192` / `InputsSignaturesLengthMismatch`, from
  calling `wallet.signRecipe()` on a recipe that
  `registerNightUtxosForDustGeneration()` had already internally signed —
  a double-signing bug in this project's own script, not a network or SDK
  defect. Fixed by matching the official docs.midnight.network "Funding a
  wallet" sample exactly (skip the extra `signRecipe` call for this one
  recipe type; also corrected `additionalFeeOverhead` from the local
  devnet's `1_000n` to the real network's `300_000_000_000_000n`, per the
  same sample).
- **Transient `Wallet.Sync` errors** appeared periodically (roughly every
  20–60 minutes) during every long sync, across all three contracts'
  deployments. None were fatal — the process logged the error and
  resumed normal progress pings afterward every time. Not fully
  root-caused; treated as background network/connection churn, not
  reported as a protocol or tooling failure since it never actually
  blocked completion.
- **One real infrastructure interruption**: partway through the first
  Core deployment attempt, the local Docker/WSL environment went idle and
  the `midnight-proof-server` container stopped, silently breaking the
  in-progress run. Restarting the container and retrying resolved it.
  Every subsequent long-running script pings the proof server on its own
  2-minute heartbeat specifically so this class of failure is visible in
  the log immediately rather than discovered later as an opaque failure.
- **A validation false-pass was caught and discarded, not reported as a
  real result** — see Core's replay-check note above. The corrected
  patient-wallet re-run is what's reported in this document.
- **Total elapsed wall-clock time** across all three contracts' DUST
  syncs was on the order of 12+ hours combined (Core ~3h48m on the
  successful attempt, Registry ~3h40m, Claim Ledger ~5h — the longest of
  the three, including two transient `Wallet.Sync` errors it recovered
  from on its own). No caps were placed on any of these waits after the
  first Core attempt (which was capped at 3 hours and had to be
  restarted); every later wait ran to genuine, uninterrupted completion.

## Frontend Integration

**Not performed.** Per explicit scope: this task is deployment,
independent verification, and real-contract validation only. The
frontend continues to run against the Simulator exclusively; nothing here
changes that, and no frontend files were touched.

## Repository State

- Files changed: `devnet-test/src/preprod-addresses.json` (real deployed
  addresses and validation results), plus this document.
- Deployment tooling (`preprod-deploy-validate-registry.ts`,
  `preprod-deploy-validate-claims.ts`, `preprod-patient-wallet.ts`) was
  added and committed in an earlier session before this deployment run.
- No contract source, circuit, or frontend files were modified.
- No secrets committed: the real funding mnemonic lives only in
  `devnet-test/.env.preprod`, confirmed gitignored
  (`.gitignore`'s `.env.*` pattern); a repository-wide scan for the
  mnemonic variable's actual value and for private-key material found
  nothing outside that gitignored file.
- Contract test suite: 55/55 passing, unchanged (no contract source was
  touched by this work).

## Final Verdict

**FULL PREPROD DEPLOYMENT VERIFIED**

All three contracts — Quorum Core, Quorum Registry, Consequence Claim
Ledger — are genuinely deployed on Midnight Preprod, independently
confirmed reachable through the live indexer (not inferred from local
script output), and each has real, on-chain transaction evidence for its
core invariants, including correctly-rejected invalid operations bearing
the contract's own real assertion messages.
