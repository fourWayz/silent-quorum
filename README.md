# Silent Quorum

An atomic threshold-ignition protocol on Midnight — three contracts with
distinct responsibilities: private eligibility and threshold firing
(**Quorum Core**), curated deployment discovery (**Quorum Registry**), and
privacy-preserving recipient claims (**Consequence Claim Ledger**).

## The problem

Collective action — a strike vote, a shareholder revolt, a coordinated
disclosure — needs a critical mass before anyone can safely act. The first
person to commit is exposed before the group is strong enough to protect
them. Revealing pledge #1 early can get pledge #1 fired before pledge #2
ever arrives.

## Why privacy matters here

A transparent pledge list doesn't just cost participants comfort — it
breaks the mechanism outright. If identity #1's pledge were visible, it
could be targeted before identity #2 ever showed up, and the coalition
would never reach critical mass. Privacy isn't a feature bolted onto this
protocol; the threshold mechanism doesn't work without it.

## The three-contract architecture

```
QUORUM CORE  →  atomic: register, pledge, threshold, consequence
QUORUM REGISTRY  →  curated discovery: which Core instances exist
CONSEQUENCE CLAIM LEDGER  →  who can prove they're the named recipient
```

Quorum Core is the whole cryptographic protocol — everything in the pledge
flow below happens in one circuit, one transaction, one proof. Registry
and Claim Ledger are separate contracts with separate jobs; **neither can
read Core's on-chain state**, because Compact 0.31.1 has no cross-contract
reads. See `ARCHITECTURE.md` for exactly what that does and doesn't mean.

## The pledge flow

1. A participant generates a secret locally and derives a public
   commitment. The commitment is registered on-chain (issuer-authorized);
   the secret never is.
2. To pledge, the participant proves — without revealing which registered
   commitment is theirs — that they hold a secret behind *some* commitment
   in the eligibility set.
3. A domain-separated nullifier prevents the same identity pledging twice
   in the same quorum, independent across quorums, actions, and
   organizations.
4. The pledge that crosses the threshold performs the consequence — an
   escrow release — in the same transaction. No separate `finalize()`,
   no off-chain keeper.

## The threshold consequence

`fired` and `consequence_balance` update atomically with the crossing
pledge. Verified three separate times on a live local devnet, not just in
a simulator: two independently-proved transactions racing for the same
threshold-crossing slot always resolve to exactly one winner — the network
rejects the stale one before it lands, not after.

## The recipient claim flow

After a quorum fires, the party Core named as recipient
(`consequence_recipient_commitment`) can prove — to the separate
Consequence Claim Ledger contract — that they hold the secret behind that
commitment, establishing a durable, privacy-preserving public claim
record. **The Claim Ledger cannot verify that the referenced quorum
actually fired** — it has no way to read Core's state. A claim there means
"this claimant owns the named commitment," never "the quorum fired." A
client checking a claim's legitimacy reads both contracts independently
and compares.

## What is actually verified on-chain

**Cryptographically enforced:** pledge membership, nullifier uniqueness,
exactly-once threshold firing, issuer/operator/arbiter authorization,
recipient-secret ownership, Registry's first-write-wins/append-only
registration.

**Client-verified, never on-chain:** that a Registry entry's claimed
`coreAddress`/`configCommitment` matches a real Core instance; that a
claim refers to a quorum that actually fired; any real-world settlement of
a claimed consequence. See `ARCHITECTURE.md`'s "Cryptographically enforced
vs. client-verified" table — don't guess which category something falls
into, that table is the authoritative source.

## Limitations, stated plainly

- **The running pledge count is public.** Participant identities are
  private. The running pledge count is public in the current protocol.
  This is not an oversight — see `ARCHITECTURE.md`'s "Open research."
- **Issuer/operator/arbiter authorization is a single shared secret, not
  public-key signatures.** No signature-verification API exists in
  Compact 0.31.1 — confirmed empirically, not assumed. Whoever holds the
  relevant secret has that role's full authority.
- **The Registry is intentionally curated, not permissionless.** A fully
  decentralized, poison-resistant registry needs multi-party signature
  authorization this toolchain doesn't have yet.
- **No expiration or deadline exists anywhere.** Compact 0.31.1 has no
  trustworthy on-chain clock. Lifecycle (`close_registration`, `cancel`)
  is action-triggered by the issuer, never time-triggered.
- **Registry and Claim Ledger cannot verify Core's state.** Stated
  repeatedly on purpose — it's the single most important fact about this
  architecture.

## Current implementation status

All three contracts implemented, compiled against toolchain 0.31.1
(ledger-8.0.2 — matched to current mainnet), with 52 tests passing against
the real compiled contracts via `@midnight-ntwrk/compact-runtime`'s local
simulator, plus four separate live-devnet race scenarios (see
`ARCHITECTURE.md`). No frontend, no wallet UX, no mainnet deployment.

## Running the tests

```sh
cd contract
npm install
npm run compact   # compiles all three .compact sources, generates proving keys
npm test          # runs the full suite against the compiled contracts
```

Live-devnet tests (`devnet-test/`) require a running local standalone
network — see `ARCHITECTURE.md`'s "Live-devnet results" for the exact
stack and reproduction steps.
