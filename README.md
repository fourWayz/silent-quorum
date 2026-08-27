# Silent Quorum

An atomic threshold-ignition protocol on Midnight. Also described as: a
privacy-preserving atomic assurance contract.

## The problem

Collective action — a strike vote, a shareholder revolt, a coordinated
disclosure — needs a critical mass before anyone can safely act. The first
person to commit is exposed before the group is strong enough to protect
them. Revealing pledge #1 early can get pledge #1 fired before pledge #2
ever arrives.

## How the protocol works

1. A participant generates a secret locally and derives a public commitment
   from it. The commitment is registered on-chain; the secret never is.
2. To pledge, the participant proves, without revealing which registered
   commitment is theirs, that they hold a secret behind *some* commitment in
   the eligibility set.
3. A domain-separated nullifier prevents the same identity from pledging
   twice in the same quorum, while staying independent across different
   quorums and organizations.
4. The pledge that crosses the threshold performs the consequence — an
   escrow release — in the same transaction. There is no separate
   `finalize()` step and no off-chain keeper.

## What Midnight provides

Compact's ledger-native `HistoricMerkleTree`, `Map`, and `Counter` types; a
compiler-enforced disclosure boundary that tracks witness-derived data
through the whole circuit; and ordinary `if`/`else` control flow that's
unrestricted for ledger writes — which is what lets the threshold check and
the consequence live in the same circuit as the pledge itself.

## The privacy boundary

**Hidden:** identity, which registered commitment produced a given pledge,
the identity secret, the Merkle membership path.

**Public, by deliberate v1 scope:** the running pledge count, every
pledge's timing, the eligibility tree's size, and (unless sponsored) the
wallet paying each pledge's fee.

> Participant identities are private. The running pledge count is public
> in v1.

This is not an oversight. See `ARCHITECTURE.md` for why hiding the count
too is an open research problem, not a near-term feature.

## Current implementation status

Milestone 1: the Compact contract, its witnesses, and a test suite running
against the real compiled contract via `@midnight-ntwrk/compact-runtime`'s
local simulator (14 tests). Beyond that, the network-level concurrency
question has also now been tested against a real local devnet — see
`ARCHITECTURE.md`'s "Live-devnet concurrency test" for the full result:
two genuinely independent pledgers raced for the same threshold-crossing
slot, and the network rejected the stale one outright rather than letting
both land. No frontend, no wallet UX, no mainnet deployment.

## Running the tests

```sh
cd contract
npm install
npm run compact   # compiles the .compact source and generates proving keys
npm test          # runs the suite against the compiled contract
```

The live-devnet race test (`devnet-test/`) requires a running local
standalone network — see `ARCHITECTURE.md` for the exact stack and how to
reproduce it.

## Known limitations

- The running pledge count is public (see above).
- The live-devnet race test covered one race, at one timing gap (263ms),
  between two pledgers. It's a real, positive result, not an exhaustive
  proof of the network's conflict handling under every timing or load
  condition — see `ARCHITECTURE.md`.
- DUST sponsorship is entirely unexercised at this milestone; multi-sponsor
  mechanics remain unresolved.
- This is a composition of two known mechanisms (anonymous group
  signaling, and a threshold-triggered assurance contract), engineered to
  execute atomically on Midnight — not a new cryptographic primitive. See
  `ARCHITECTURE.md` for prior art.
