# Architecture

## Protocol flow

1. **Setup.** The constructor seals `org_id`, `quorum_id`, `action_id`,
   `threshold`, `consequence_recipient`, and `consequence_amount`. Sealed
   fields cannot be changed by any exported circuit after construction.
2. **Registration.** A participant generates `identitySecret` locally and
   derives `identityCommitment = persistentHash([leafTag, identitySecret])`.
   Only the commitment is submitted to `register()`, which inserts it into
   `eligibility_tree`. The issuer calling `register` never receives
   `identitySecret`.
3. **Pledge.** The `pledge` circuit: reads the witness-held secret and
   Merkle path; recomputes the leaf from the secret and asserts it matches
   the path's embedded leaf (binding the path to *this* secret, not an
   arbitrary one); checks the recomputed root against the tree; derives a
   domain-separated nullifier and asserts it hasn't been spent; records it;
   increments `tally`; and, if `tally` has now reached `threshold` and the
   quorum hasn't already fired, sets `fired = true` and releases
   `consequence_balance` — all in the same circuit call.

## Ledger state

| Field | Type | Public/Private | Notes |
|---|---|---|---|
| `org_id`, `quorum_id`, `action_id` | `sealed Bytes<32>` | Public | Domain separation inputs, immutable after init |
| `threshold` | `sealed Uint<32>` | Public | Deliberately public; sealing prevents a mid-flight change |
| `consequence_recipient`, `consequence_amount` | `sealed` | Public | Fixed at setup; a trusted role by definition |
| `eligibility_tree` | `HistoricMerkleTree<10, Bytes<32>>` | Public structure, leaves are commitments not identities | Tree size is publicly countable |
| `pledge_nullifiers` | `Map<Bytes<32>, Boolean>` | Public | Entries are unlinkable hashes |
| `tally` | `Counter` | **Public — deliberate v1 limitation** | See README |
| `fired` | `Boolean` (not sealed) | Public | Must be writable once, post-init — `sealed` cannot do this |
| `consequence_balance` | `Uint<64>` | Public | Result of firing |
| `identitySecret` | witness-only | **Never ledger state** | The one value the design exists to protect |

## Cryptographic construction

```
identityCommitment = persistentHash([pad(32,"silent-quorum:leaf:"), identitySecret])
nullifierDomain     = persistentHash([pad(32,"silent-quorum:domain:"), org_id, quorum_id, action_id])
nullifier            = persistentHash([identitySecret, nullifierDomain])
```

Registration (Model B): the participant self-generates `identitySecret` and
only ever discloses `identityCommitment`. This is Semaphore's registration
pattern — self-generated identity, issuer never sees the secret, hidden-path
membership proof — adapted to Compact's primitives, not invented here.

## Circuits

- `register(identityCommitment: Bytes<32>)` — inserts a commitment into the
  eligibility tree.
- `pledge()` — the one circuit that does everything in §"Protocol flow"
  step 3, atomically.

## Empirical findings from Milestone 1

These were discovered by actually compiling and testing against Compact
toolchain 0.31.1 (ledger-8.0.2, language 0.23.0, runtime 0.16.0 — chosen to
match current mainnet, not the newer 0.34.0 toolchain also installed, which
targets a ledger version not yet deployed to mainnet), not assumed from
documentation alone:

- **Disclosure tracking is broader than "witness-sourced values only."**
  Every constructor and circuit *parameter* is treated as potentially
  private until explicitly `disclose()`d, including ordinary public setup
  values like `org_id`. The compiler rejected the first draft of this
  contract on exactly this basis, for six separate parameters.
- **`fired` cannot be `sealed`.** A sealed field can only be set once, at
  construction. `fired` must flip from false to true later, so it's an
  ordinary `Boolean` ledger field guarded by program logic, not the
  language's immutability feature.
- **A pledge after firing is accepted, not rejected.** The first working
  version put `assert(!fired)` inside the threshold-check branch, which
  made every post-fire pledge revert its entire transaction — silently
  dropping it instead of just skipping the consequence. This was a real
  bug, found by the test suite, not a deliberate design choice. The fix
  wraps the whole threshold-check in `if (!fired) { ... }`, so the tally
  keeps counting latecomers but the consequence never re-executes.
- **Model B composes with atomic same-transaction firing.** The full
  registration → pledge → threshold-crossing → consequence flow compiles,
  generates real proving/verifying keys, and passes 14 tests against the
  actual compiled contract (via `@midnight-ntwrk/compact-runtime`'s local
  simulator — the same pattern `midnightntwrk/example-counter` uses).

## Live-devnet concurrency test (resolved)

The in-process simulator executes one circuit call against one mutable
context at a time — it has no model of two independently-proved transactions
racing against a live network, so it could not answer the one question the
pre-implementation spec flagged as highest-priority: does Midnight reject a
transaction proved against now-stale state when two pledges race for the
same threshold crossing? That required an actual local devnet, standing up
the exact stack the official support matrix pairs with Compact toolchain
0.31.1 (`midnight-node:1.0.0`, `indexer-standalone:4.3.3`,
`proof-server:8.1.0`, via `midnightntwrk/midnight-local-dev`'s
`standalone.yml`).

**Method.** A contract was deployed with `threshold=4` and driven to
`tally=2` via two uncontested sequential pledges. Two more identities
(`p3`, `p4`) were registered. Two genuinely separate OS processes — not two
async branches sharing one process, which turned out to matter (see below)
— then each independently queried the live ledger (both observed
`tally=2, fired=false`), built a proof against that state, and submitted a
pledge. Launch was 263ms apart:

| Racer | Pre-submission read | Submission time (UTC) | Outcome |
|---|---|---|---|
| Bob (p4) | tally=2, fired=false | 10:57:31.343 | **Accepted** — block 780, tally→3 |
| Alice (p3) | tally=2, fired=false | 10:57:31.606 | **Rejected by the node** — `TransactionInvalidError: Transaction is invalid and was rejected by the node` |

Final state after the race: `tally=3, fired=false` — not 4, not a double
count. Alice's nullifier was never spent (her transaction never applied at
all), so she retried unmodified moments later, now correctly reading
`tally=3`:

| Racer | Pre-submission read | Outcome |
|---|---|---|
| Alice (p3), retry | tally=3, fired=false | **Accepted** — block 838, `tally=4, fired=true, consequence_balance=1000` |

**Result: the network itself enforces exactly-once, not just the
contract's `assert(!fired)` guard.** A transaction proved against
already-superseded public state is rejected outright at node validation,
before it ever reaches the circuit's own logic. Two conflicting pledges
cannot both land; at most one does, and the loser's nullifier is never
consumed, so retrying is always safe. This is a materially stronger
guarantee than the in-process simulator could demonstrate, and it closes
the one question this project's research repeatedly flagged as open.

**A real, separate finding along the way:** the first version of this test
ran both racers as concurrent async branches of *one* Node process, sharing
`@midnight-ntwrk/midnight-js-level-private-state-provider`'s LevelDB-backed
storage. That failed intermittently with `Database failed to open` —
sometimes on Alice's side, sometimes on Bob's — even with each account
pointed at a distinct store. That's a local client-library concurrency
limit, not a network property, and it invalidated that version of the test
(one racer never even got far enough to submit). Splitting into two
independent OS processes (`setup.ts` then two `racer.ts` invocations) fixed
it and is arguably the more honest test anyway — two real independent
pledgers are two separate machines, not two `Promise.all` branches.

**Not yet tested:** races with the ordering reversed, races closer than
263ms, races between more than two simultaneous pledgers, and behavior
under sustained/adversarial concurrent load. The result above is a real,
positive data point, not an exhaustive proof of the network's conflict
resolution under every condition.

**Reproducing it:**

```sh
# 1. Bring up the exact stack the support matrix pairs with toolchain 0.31.1:
git clone https://github.com/midnightntwrk/midnight-local-dev.git
cd midnight-local-dev && npm install
cp .env.example .env   # adjust MN_*_PORT if the defaults collide with anything
docker compose -f standalone.yml up -d
cp accounts.example.json accounts.json
npm start -- --fund-config ./accounts.json   # funds Alice and Bob with NIGHT + DUST

# 2. From this repo:
cd devnet-test && npm install
npx tsx src/setup.ts            # deploys, reaches tally=2, registers p3/p4
npx tsx src/racer.ts alice p3 & npx tsx src/racer.ts bob p4 &   # the race
wait
```

Two important details if you adapt this: each racer must be its own OS
process (see the LevelDB finding above), and `devnet-test/src/shared.ts`'s
`envConfig` must point at whatever ports `midnight-local-dev`'s `.env`
actually published.

## Security invariants

| | Invariant | Status |
|---|---|---|
| I1 | One pledge per credential per quorum | Verified — nullifier + `Map.member`, tested |
| I2 | Only registered commitments can pledge | Verified — `checkRoot`, tested |
| I3 | A pledge doesn't reveal which commitment produced it | Verified by construction (hidden-path proof); not independently audited beyond this milestone |
| I4 | Consequence cannot execute before threshold | Verified, tested |
| I5 | Threshold-crossing pledge fires the consequence in the same transaction | Verified, tested |
| I6 | Consequence cannot execute twice | Verified for sequential application (tested) **and under real live-devnet concurrency** (see "Live-devnet concurrency test" above) |
| I7 | `fired` is irreversible | Verified, tested |
| I8 | A pledge can't replay across quorums | Verified, tested |
| I9 | Secret and path never enter disclosed state | Verified, tested (explicit regression test) |
| I10 | No public proof of one's own pledge | Verified by construction (receipt-free, inherited from the Semaphore-family design); not independently tested |

## Prior art

This is a composition of known mechanisms, not a new cryptographic
primitive:

- **Semaphore** — anonymous, issuer-unlinkable group signaling with
  double-signal prevention. The identity layer here adopts this pattern;
  it does not invent it.
- **Dominant assurance contracts** (Tabarrok, 1998) and Kickstarter's
  threshold-triggered, refund-if-not-met funding model — the economic
  mechanism behind the consequence is decades old in theory and over a
  decade old in production, unprivately.
- **MACI** — the closest prior art for "public consequence from private
  inputs," but requires a trusted coordinator to decrypt and tally; this
  design avoids that by firing atomically within the crossing transaction
  itself.

What's actually new: the atomic composition of the two — the
threshold-crossing signal and the consequence firing in the same
transaction, no relayer, no separate finalize call, no keeper.

## Open research

Hiding the running tally (not just identities) appears to require either a
trusted T-of-N threshold-decryption committee (the Helios pattern) or a
non-interactive adaptation of a synchronous no-trusted-party scheme like
Open Vote Network to an asynchronous, open-membership setting — which, as
far as this project's research found, nobody has published. Not attempted
in Milestone 1.
