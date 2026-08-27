# Architecture

Silent Quorum is three contracts with three distinct, non-overlapping
responsibilities:

```
┌───────────────────────────────┐
│  QUORUM CORE  (per instance)   │  ← the atomic boundary. Register, pledge,
│  register → pledge → fire      │    threshold, and consequence never leave
└───────────────┬─────────────────┘    this one circuit / one transaction.
                │
     no on-chain link — a client reads both independently and
     compares config_commitment (see "Cross-contract limitation" below)
                │
   ┌────────────┴─────────────┐
   ▼                           ▼
┌──────────────────┐   ┌──────────────────────┐
│ QUORUM REGISTRY   │   │ CONSEQUENCE CLAIM     │
│ curated discovery │   │ LEDGER: recipient     │
│ of Core instances │   │ ownership + record    │
└──────────────────┘   └──────────────────────┘
```

Multiple quorum *instances* (a shareholder action, an incident-response
quorum, etc.) need no new contract code — each is a fresh Quorum Core
deployment with different constructor arguments. The Registry's job is
making those deployments discoverable.

## Cross-contract limitation — read this before anything else

Compact 0.31.1/ledger-8.0.2 has no cross-contract calls and no cross-contract
state reads. Verified empirically this session: `secp256k1EcdsaVerify` and
`jubjubSchnorrVerify` both fail as unbound identifiers, and no on-chain
time/block-height primitive exists either (`blockHeight`, `currentTime`,
`now`, and four other candidate names were each tested individually and
each is unbound). Confirmed directly by a Midnight technical lead on the
official forum: contracts cannot deploy other contracts, and cannot read
each other's ledgers from inside a circuit.

**Consequence:** every relationship between Silent Quorum's three contracts
is two independently-true facts a client reads and compares — never an
on-chain-enforced link.

- The Registry's `configCommitment` for a quorum may not match what that
  quorum's Core contract actually has. The Registry only records what the
  operator *claimed*.
- The Claim Ledger's `claim()` succeeds whether or not the referenced
  quorum ever fired, whether or not `recipientCommitment` matches any real
  Core instance, and whether or not the caller supplied a `quorumId` that
  exists anywhere. It proves the caller knows a secret matching the value
  *they themselves supplied* — nothing more.

### Cryptographically enforced vs. client-verified

| Cryptographically enforced (on-chain, by a circuit) | Client-verified (off-chain, by whoever's using the protocol) |
|---|---|
| Pledge membership (Merkle path + leaf binding) | Registry's `coreAddress` actually hosts the claimed Core instance |
| Nullifier uniqueness (one pledge per identity per quorum) | Registry's `configCommitment` matches Core's own `config_commitment` |
| Threshold transition and exactly-once consequence firing | A claim refers to a Core instance that actually fired |
| Issuer/operator/arbiter shared-secret authorization | External, real-world settlement of a claimed consequence |
| Recipient-secret ownership for a claim | Whether a quorum's threshold was reached "for a good reason" |
| Registry first-write-wins, append-only registration | — |

### Known privacy limitation: identity-commitment reuse across quorums

`leafFor()` (mirrored on-chain by `pad(32, "silent-quorum:leaf:")` in
`silent-quorum.compact`'s `pledge()`) hashes only the identity secret —
it is **not** domain-separated by `org_id`/`quorum_id`/`action_id`. The
pledge nullifier *is* domain-separated (`persistentHash([secret,
domain])` where `domain` folds in org/quorum/action), so pledges made
with the same secret in two different quorums are cryptographically
unlinkable to each other. But `register()`'s `identityCommitment`
argument — the Merkle leaf itself — is not: registering the same secret
in two separately-deployed Core instances inserts byte-identical leaves
into both instances' public `eligibility_tree`s. Anyone comparing the two
trees can observe that the same participant registered in both quorums,
even though they cannot tell whether that participant later pledged in
either one.

This is a real limitation, not a hypothetical: `silent-quorum.test.ts`
demonstrates it directly (`commitmentFor(secret)` is deliberately reused
across `quorumA`/`quorumB` in the existing cross-quorum pledge tests, and
a dedicated "identity-commitment linkability" test suite confirms both
the collision with a reused secret and the absence of one with a fresh
per-quorum secret). The practical mitigation is entirely client-side: use
a fresh identity secret per quorum. Fixing this on-chain — folding
org/quorum/action into the leaf formula the same way the nullifier does —
would change the leaf/commitment format and is out of scope for this
audit pass; it is left as an open item, not silently ignored.

---

## Contract A — Quorum Core

Unchanged in shape from Milestone 1, extended with issuer authorization,
lifecycle, and a deterministic configuration commitment. Still the entire
cryptographic heart: everything below stays in **one circuit, one
transaction, one proof** — verified on live devnet three times over now
(see "Live-devnet results" below), not just asserted.

### Protocol flow

1. **Setup.** The constructor seals `org_id`, `quorum_id`, `action_id`,
   `threshold`, `issuer_commitment`, `consequence_recipient_commitment`,
   `consequence_amount`, and `protocol_version` (`2`), then computes
   `config_commitment` — a deterministic hash of every field above,
   independently reproducible by any client from the same constructor
   arguments (see `contract/src/domain.ts`'s `configCommitmentFor`, verified
   byte-for-byte against the real on-chain value in
   `silent-quorum.test.ts`).
2. **Registration.** A participant generates `identitySecret` locally and
   derives `identityCommitment`. Only the commitment is submitted to
   `register()`, which now requires the caller to prove knowledge of
   `issuer_commitment`'s preimage (see "Issuer authorization" below) and
   checks `registration_open`.
3. **Pledge.** Reads the witness-held secret and Merkle path; recomputes
   the leaf and asserts it matches the path's embedded leaf; checks the
   recomputed root against the tree; derives a domain-separated nullifier
   and asserts it hasn't been spent; records it; increments `tally`; and,
   if not already fired and the new tally reaches `threshold`, sets
   `fired = true` and releases `consequence_balance` — all in the same
   call. Also asserts `!cancelled`.
4. **Lifecycle.** `close_registration()` and `cancel()`, both
   issuer-gated, both one-way. No expiration exists — see "Issuer
   authorization" for why.

**Post-fire behavior, stated explicitly.** Neither `register()` nor
`pledge()` checks `fired`: new identities can still be registered, and
already-registered identities can still pledge (and be counted in
`tally`), after the quorum has fired. This is deliberate, not an
oversight — see Milestone 1's fix for why an `assert(!fired)` guard on
pledge is actively wrong (it would revert, and thus drop, every honest
post-fire pledge instead of just skipping the already-done re-fire logic).
`fired` and `consequence_balance` are one-way: once set, nothing in this
contract ever unsets them. Symmetrically, `cancel()` has no `!fired`
guard either — calling it after firing is accepted and flips `cancelled`
to `true`, but has no effect on the already-released `consequence_balance`
or `fired` flag. `cancelled` after firing is a symbolic record only (it
signals "the issuer no longer stands behind this quorum accepting further
pledges") — it does not and cannot claw back a consequence already fired
atomically in an earlier transaction. Both properties are covered by
`silent-quorum.test.ts`.

### Ledger state

| Field | Type | Notes |
|---|---|---|
| `org_id`, `quorum_id`, `action_id` | `sealed Bytes<32>` | Domain separation, immutable |
| `threshold` | `sealed Uint<32>` | Public by design |
| `issuer_commitment` | `sealed Bytes<32>` | New — closes Milestone 1's permissionless `register()` gap |
| `consequence_recipient_commitment` | `sealed Bytes<32>` | Renamed/changed from a bare tag to a commitment — this is what the Claim Ledger gates on |
| `consequence_amount` | `sealed Uint<64>` | |
| `protocol_version` | `sealed Uint<16>` | `2` |
| `config_commitment` | `sealed Bytes<32>` | Deterministic hash of the eight fields above |
| `eligibility_tree` | `HistoricMerkleTree<10, Bytes<32>>` | Unchanged |
| `pledge_nullifiers` | `Map<Bytes<32>, Boolean>` | Unchanged |
| `tally` | `Counter` | **Public — deliberate limitation, see README** |
| `fired`, `consequence_balance` | | Unchanged |
| `registration_open` | `Boolean` | New — one-way true→false |
| `cancelled` | `Boolean` | New — one-way false→true |

### Issuer authorization

A shared-secret role gate, not public-key signature authorization:

```
persistentHash(issuerSecret) == issuer_commitment
```

No signature-verification API exists in Compact 0.31.1 — confirmed
empirically, not assumed (see "Cross-contract limitation" above). Whoever
knows `issuerSecret` can `register`, `close_registration`, or `cancel`.
This is a real, named limitation: one shared secret, not a multi-party PKI.

**No expiration exists anywhere in this design.** Compact 0.31.1 has no
trustworthy on-chain clock, and a caller-supplied timestamp would be
exactly the kind of unverifiable witness value the rest of this protocol
is built to avoid trusting. Lifecycle here is entirely action-triggered
(an authorized call), never time-triggered. Calling `close_registration()`
or `cancel()` a second time is a harmless no-op (same value written again),
not a rejected transaction — an M1-class bug (an `assert` guarding an
idempotent state change reverts, and thus drops, every honest repeat) is
exactly what this design avoids repeating.

---

## Contract B — Quorum Registry

A curated discovery layer, explicitly not a verification layer. Records
what a single trusted operator (the same shared-secret pattern as Core's
issuer) claims about a deployed Core instance.

```compact
struct QuorumRecord {
  coreAddress: ContractAddress;
  configCommitment: Bytes<32>;
  status: QuorumStatus;  // ACTIVE | DEACTIVATED
}
ledger quorums: Map<Bytes<32>, QuorumRecord>;
```

`ContractAddress` is a first-class Compact type — confirmed empirically by
compiling a throwaway contract using it, not assumed from documentation.

**Deliberately centralized rather than permissionless-but-poisonable.** A
fully decentralized, poison-resistant registry (where anyone can register,
first-write-wins, with no way for an attacker to squat a real deployer's
`quorumId` first) needs multi-party signature authorization this toolchain
doesn't have. The trade-off is explicit, not hidden: `register_quorum` and
`deactivate_quorum` both require the operator secret; registration is
append-only (no update circuit exists for an already-registered
`quorumId`); deactivation is one-way (no reactivate circuit exists).

**The Registry never verifies a claim.** See "Cross-contract limitation."

---

## Contract C — Consequence Claim Ledger

Proves exactly one thing: *this claimant knows the secret behind the
recipient commitment they supplied.* It does not and cannot mean "the
referenced Quorum Core fired" — this contract never sees Core's ledger at
all.

```compact
struct ClaimRecord {
  recipientCommitment: Bytes<32>;
  consequenceType: Uint<8>;
  status: ClaimStatus;  // CLAIMED | DISPUTED
}
ledger claims: Map<Bytes<32>, ClaimRecord>;  // keyed by claimId
```

Unlike Core's pledge nullifier, no secret-derived nullifier is used for
uniqueness. `(org, quorum, action)` is already public by necessity — a
caller must supply it to look anything up — so
`claimId = persistentHash([tag, orgId, quorumId, actionId])` can be the map
key directly. The recipient secret's only role is the ownership proof
(the same pattern `example-bboard`'s reference contract uses for its
`owner` field), not deriving a hiding key: there is no anonymity set to
protect here the way there is for "which registered identity pledged" in
Core — the recipient is already publicly named via
`consequence_recipient_commitment`.

`dispute()` is a second, separately-gated circuit (its own
`arbiter_commitment`), one-way to `DISPUTED`, for exactly the case where a
claim's legitimacy is contested after the fact by *some* external process —
it does not and cannot itself determine whether a dispute is justified.

**Claim transfer/delegation was investigated and deliberately deferred** —
real complexity, no clear benefit for this milestone.

---

## Live-devnet results

All three contracts were tested against the exact stack the official
support matrix pairs with Compact toolchain 0.31.1 (`midnight-node:1.0.0`,
`indexer-standalone:4.3.3`, `proof-server:8.1.0`, via
`midnightntwrk/midnight-local-dev`'s `standalone.yml`), not just the
in-process simulator.

### Quorum Core: pledge-vs-pledge (Milestone 1 result, unchanged)

Two independent OS processes, both reading `tally=2, fired=false`,
submitted 263ms apart. Bob's landed (block 780); Alice's was
**rejected by the node before inclusion**
(`TransactionInvalidError: Transaction is invalid and was rejected by the
node`). Final state: `tally=3`, not 4, not doubled. Alice's retry against
the now-current state succeeded cleanly (block 838,
`tally=4, fired=true, consequence_balance=1000`).

### Quorum Registry: duplicate `quorumId` (I16)

Same pattern. Two processes both attempted `register_quorum` for the same
`quorumId`, 219ms apart. Bob's landed (block 1641); Alice's was
**rejected by the node before inclusion**, same `TransactionInvalidError`.

### Consequence Claim Ledger: duplicate claim (I19)

Same pattern again. Two processes, both knowing the same recipient secret,
submitted the same claim 440ms apart. Bob's landed (block 1765); Alice's
was **rejected by the node before inclusion**.

### Core: `cancel()` vs `pledge()` — a genuinely different result

This one did **not** follow the same pattern, and that's worth stating
plainly rather than smoothing over. Setup: `threshold=2`, one uncontested
pledge in (`tally=1`), a second identity registered. Alice submitted
`cancel()` and Bob submitted `pledge()` 363ms apart (Bob first,
14:07:58.829; Alice second, 14:07:59.192), both reading
`tally=1, fired=false, cancelled=false` beforehand.

- Alice's `cancel()`: **accepted**, block 1929, `cancelled` → `true`.
- Bob's `pledge()`: **included on-chain at block 1930** — not rejected
  before inclusion — but marked `"status": "FailFallible"`, with
  `"segmentStatusMap"` showing one segment (`40076`) failed. Final state
  confirms no harm: `tally` stayed at `1`, `consequence_balance` stayed
  `0` — the failed pledge had no effect.

**Why this differs, best hypothesis, not confirmed:** the three races
above all involve two transactions reading and writing the *same*
structurally-tracked value (a `Counter`, or inserting into a `Map` at the
same key) — exactly the shape Kachina's transcript mechanism is documented
to detect and reorder/reject pre-inclusion. `cancel()` and `pledge()`
touch different fields (`cancelled` vs. `tally`/`pledge_nullifiers`); the
conflict between them is *logical* (pledge's own `assert(!cancelled)`
depends on a value cancel changes) rather than a structural same-cell
write-write collision. The optimistic-concurrency layer may simply not
recognize this as the same class of conflict, letting both transactions
attempt inclusion and leaving the losing one to fail at actual circuit
execution instead of at submission.

**This is not a security regression** — I13 held (no pledge succeeded
after cancellation) and I6 held (no double-anything) — but it reveals that
"the network rejects a stale transaction before it lands" is not a
uniform guarantee across every conflict shape in this system. Sometimes
the network includes a losing transaction and fails it in-place instead.
Recorded here as an open question for further investigation, not
something this milestone attempts to resolve or that changes the
protocol's design.

### A recurring local-tooling finding, not network evidence

Every race above needed at least one retry due to
`Database failed to open: IO error: lock midnight-level-db/LOCK: Resource
temporarily unavailable` — a wallet-SDK-level LevelDB lock at a fixed,
non-account-scoped path shared by every process launched from
`devnet-test/`, distinct from (and in addition to) the
per-account `levelPrivateStateProvider` collision Milestone 1 already
documented. Confirmed via `fuser` that the stale lock was held by no live
process before deleting it. This is a client-tooling limitation, not
something the network or these contracts do — reported precisely so a
future run isn't misread as a network anomaly.

### Not yet tested

Races with the ordering reversed, races closer than the ~200–450ms gaps
observed, three-or-more-way races, sustained/adversarial concurrent load,
and — especially — a deeper investigation into exactly why
`cancel()`-vs-`pledge()` produced a `FailFallible` inclusion instead of a
pre-inclusion rejection.

### Reproducing it

```sh
# Bring up the devnet (see midnight-local-dev's own README for the full
# quick-start); then, per scenario, from devnet-test/:
npx tsx src/setup.ts && npx tsx src/racer.ts alice p3 & npx tsx src/racer.ts bob p4 & wait
npx tsx src/registry-setup.ts && npx tsx src/registry-racer.ts alice X & npx tsx src/registry-racer.ts bob Y & wait
npx tsx src/claim-setup.ts && npx tsx src/claim-racer.ts alice & npx tsx src/claim-racer.ts bob & wait
npx tsx src/cancel-setup.ts && npx tsx src/cancel-vs-pledge-racer.ts alice cancel & npx tsx src/cancel-vs-pledge-racer.ts bob pledge & wait
```

Each racer must be its own OS process. `devnet-test/src/shared.ts`'s
`buildProviders` takes a `contractDir` argument that must match the
contract actually being called (`silent-quorum`, `quorum-registry`, or
`consequence-claim-ledger`) — getting this wrong doesn't fail loudly at
construction, only later with a `ZKConfigurationReadError` when the wrong
contract's proving keys don't contain the circuit being called.

---

## Security invariants

| | Invariant | Status |
|---|---|---|
| I1 | One pledge per credential per quorum | Verified, tested, live-devnet confirmed |
| I2 | Only registered commitments can pledge | Verified, tested |
| I3 | A pledge doesn't reveal which commitment produced it | Verified by construction; not independently audited |
| I4 | Consequence cannot execute before threshold | Verified, tested |
| I5 | Threshold-crossing pledge fires the consequence in the same transaction | Verified, tested, live-devnet confirmed |
| I6 | Consequence cannot execute twice | Verified, tested, live-devnet confirmed |
| I7 | `fired` is irreversible | Verified, tested |
| I8 | A pledge can't replay across quorums/orgs/actions | Verified, tested |
| I9 | Secret and path never enter disclosed state | Verified, tested (explicit regression test) |
| I10 | No public proof of one's own pledge | Verified by construction; not independently tested |
| I11 | Only the issuer-secret holder can register | Verified, tested |
| I12 | No registration after `close_registration()` | Verified, tested |
| I13 | No pledge after `cancel()` | Verified, tested, **live-devnet confirmed (with the FailFallible nuance above)** |
| I14 | Lifecycle flags are one-way; repeat calls are no-ops, not errors | Verified, tested |
| I15 | `config_commitment` is deterministic and client-reproducible | Verified, tested byte-for-byte against the real on-chain value |
| I16 | A `quorumId` can be registered at most once | Verified, tested, live-devnet confirmed |
| I17 | Only the registry operator can register or deactivate | Verified, tested |
| I18 | Deactivation is one-way; entries are never deleted | Verified, tested |
| I19 | One claim per `(org, quorum, action)` | Verified, tested, live-devnet confirmed |
| I20 | A claim requires proof of knowledge of the specific secret behind the specific commitment supplied | Verified, tested |
| I21 | Claim Ledger's acceptance of a claim carries no implication the referenced quorum fired | By construction, tested explicitly and deliberately (see `claim-ledger.test.ts`'s "cross-contract limitation, demonstrated not hidden") |
| I22 | Dispute is settable only by the arbiter secret-holder, one-way | Verified, tested |

## Prior art

This is a composition of known mechanisms, not a new cryptographic
primitive:

- **Semaphore** — anonymous, issuer-unlinkable group signaling. The
  identity layer adopts this pattern; it does not invent it.
- **Dominant assurance contracts** (Tabarrok, 1998) and Kickstarter's
  threshold-triggered funding model — the economic mechanism is decades
  old in theory, over a decade old in production, unprivately.
- **MACI** — the closest prior art for "public consequence from private
  inputs," but requires a trusted coordinator; this design fires
  atomically within the crossing transaction instead.
- **Contract registries as a pattern** — confirmed as the Midnight team's
  own recommended approach to multi-contract discovery on the official
  forum, not invented here either.

What's actually new: the atomic composition, and the specific three-way
split of responsibilities across Core/Registry/Claim Ledger that respects
(rather than pretends around) the toolchain's cross-contract limitations.

## Open research

- Hiding the running tally still appears to require either a trusted
  T-of-N threshold-decryption committee or a non-interactive adaptation of
  a synchronous scheme like Open Vote Network — not attempted here.
- The `FailFallible`-vs-`TransactionInvalidError` distinction found in the
  `cancel()`-vs-`pledge()` race is not yet explained from first principles
  — only observed and safely handled by existing invariants.
- A fully decentralized Registry (no single operator) is blocked on the
  same missing signature-verification capability as multi-issuer Core
  authorization.
