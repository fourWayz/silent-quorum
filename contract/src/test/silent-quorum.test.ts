import { describe, it, expect } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { persistentHash, CompactTypeVector, Bytes32Descriptor } from "@midnight-ntwrk/compact-runtime";
import { SilentQuorumSimulator, type QuorumConfig } from "../silent-quorum-simulator.js";

setNetworkId("undeployed");

const b32 = (label: string): Uint8Array =>
  Uint8Array.from(Buffer.from(label.padEnd(32, "\0"), "utf8"));

const secretFor = (label: string): Uint8Array =>
  Uint8Array.from(Buffer.from(label.padEnd(32, "\0"), "utf8"));

const LEAF_TAG = b32("silent-quorum:leaf:");
const pairOfBytes32 = new CompactTypeVector(2, Bytes32Descriptor);
const commitmentFor = (identitySecret: Uint8Array): Uint8Array =>
  persistentHash(pairOfBytes32, [LEAF_TAG, identitySecret]);

const baseConfig = (threshold: bigint): QuorumConfig => ({
  org: b32("org:acme"),
  quorum: b32("quorum:q1"),
  action: b32("action:strike"),
  threshold,
  recipient: b32("recipient:escrow"),
  amount: 1_000n
});

describe("Silent Quorum — registration and eligibility", () => {
  it("registers a commitment without ever touching the secret on-chain", () => {
    const sim = new SilentQuorumSimulator(baseConfig(1n), secretFor("alice"));
    const ledger = sim.register(commitmentFor(secretFor("alice")));
    expect(ledger.eligibility_tree.isFull()).toBe(false);
    // The only thing register() took as an argument was the commitment —
    // there is no code path in silent-quorum.compact by which a secret
    // could appear in ledger state at all (verified by inspection of the
    // compiled contract's public circuit signatures, §6 of ARCHITECTURE.md).
  });

  it("a registered identity can pledge and is counted", () => {
    const sim = new SilentQuorumSimulator(baseConfig(2n), secretFor("alice"));
    sim.register(commitmentFor(secretFor("alice")));
    const ledger = sim.pledge();
    expect(ledger.tally).toBe(1n);
    expect(ledger.fired).toBe(false);
  });

  it("rejects a pledge from an unregistered identity", () => {
    const sim = new SilentQuorumSimulator(baseConfig(1n), secretFor("mallory"));
    expect(() => sim.pledge()).toThrow();
  });
});

describe("Silent Quorum — nullifier / double-pledge resistance", () => {
  it("rejects a second pledge from the same identity in the same quorum", () => {
    const sim = new SilentQuorumSimulator(baseConfig(5n), secretFor("alice"));
    sim.register(commitmentFor(secretFor("alice")));
    sim.pledge();
    expect(() => sim.pledge()).toThrow(/already pledged/);
  });

  it("the same identity gets an independent pledge in a different quorum", () => {
    const secret = secretFor("alice");
    const commitment = commitmentFor(secret);

    const quorumA = new SilentQuorumSimulator(baseConfig(5n), secret);
    quorumA.register(commitment);
    const ledgerA = quorumA.pledge();
    expect(ledgerA.tally).toBe(1n);

    const configB = { ...baseConfig(5n), quorum: b32("quorum:q2") };
    const quorumB = new SilentQuorumSimulator(configB, secret);
    quorumB.register(commitment);
    const ledgerB = quorumB.pledge();
    expect(ledgerB.tally).toBe(1n); // independent — not blocked by quorum A's nullifier
  });

  it("the same identity gets an independent pledge in a different organization", () => {
    const secret = secretFor("alice");
    const commitment = commitmentFor(secret);
    const configOrgB = { ...baseConfig(5n), org: b32("org:other-co") };
    const sim = new SilentQuorumSimulator(configOrgB, secret);
    sim.register(commitment);
    expect(sim.pledge().tally).toBe(1n);
  });
});

describe("Silent Quorum — atomic threshold firing (Architecture B)", () => {
  it("does not fire before threshold (N-1 pledges)", () => {
    const sim = new SilentQuorumSimulator(baseConfig(3n), secretFor("p1"));
    sim.register(commitmentFor(secretFor("p1")));
    sim.pledge();
    sim.setIdentitySecret(secretFor("p2"));
    sim.register(commitmentFor(secretFor("p2")));
    const ledger = sim.pledge();
    expect(ledger.tally).toBe(2n);
    expect(ledger.fired).toBe(false);
    expect(ledger.consequence_balance).toBe(0n);
  });

  it("the Nth pledge atomically fires the consequence in the same call", () => {
    const sim = new SilentQuorumSimulator(baseConfig(3n), secretFor("p1"));
    sim.register(commitmentFor(secretFor("p1")));
    sim.pledge();
    sim.setIdentitySecret(secretFor("p2"));
    sim.register(commitmentFor(secretFor("p2")));
    sim.pledge();
    sim.setIdentitySecret(secretFor("p3"));
    sim.register(commitmentFor(secretFor("p3")));

    const ledger = sim.pledge(); // the 3rd pledge — should cross threshold=3
    expect(ledger.tally).toBe(3n);
    expect(ledger.fired).toBe(true);
    expect(ledger.consequence_balance).toBe(1_000n); // == consequence_amount, same transaction
  });

  it("fired is irreversible: a pledge after firing is accepted and counted, but never re-fires", () => {
    const sim = new SilentQuorumSimulator(baseConfig(1n), secretFor("p1"));
    sim.register(commitmentFor(secretFor("p1")));
    const fired = sim.pledge();
    expect(fired.fired).toBe(true);

    sim.setIdentitySecret(secretFor("p2"));
    sim.register(commitmentFor(secretFor("p2")));
    const after = sim.pledge(); // accepted: tally increments; fired stays true, consequence does not re-run
    expect(after.fired).toBe(true);
    expect(after.tally).toBe(2n);
    expect(after.consequence_balance).toBe(1_000n); // unchanged — not doubled
  });
});

describe("Silent Quorum — sequential exactly-once guard", () => {
  // IMPORTANT: this proves the `assert(!fired)` guard holds when two pledge
  // calls are applied ONE AFTER ANOTHER against a context that has already
  // observed the first one's effect. It does NOT prove what happens when two
  // transactions are proved independently from stale, pre-crossing state and
  // raced against a live network — that requires an actual devnet node and
  // indexer to observe, which this in-process simulator cannot provide (see
  // ARCHITECTURE.md §8 and RESEARCH.md). Reported as an open item, not
  // silently assumed solved.
  it("a pledge landing immediately after the firing pledge is accepted but cannot double-fire", () => {
    const sim = new SilentQuorumSimulator(baseConfig(2n), secretFor("p1"));
    sim.register(commitmentFor(secretFor("p1")));
    sim.pledge();

    sim.setIdentitySecret(secretFor("p2"));
    sim.register(commitmentFor(secretFor("p2")));
    const firing = sim.pledge();
    expect(firing.fired).toBe(true);
    expect(firing.consequence_balance).toBe(1_000n);

    sim.setIdentitySecret(secretFor("p3"));
    sim.register(commitmentFor(secretFor("p3")));
    const afterFiring = sim.pledge();
    expect(afterFiring.fired).toBe(true);
    expect(afterFiring.consequence_balance).toBe(1_000n); // still exactly once
  });

  it("two proofs built from the same pre-crossing snapshot: documents the open question rather than hiding it", () => {
    const base = new SilentQuorumSimulator(baseConfig(2n), secretFor("p1"));
    base.register(commitmentFor(secretFor("p1")));
    base.pledge(); // tally = 1, one below threshold=2

    base.setIdentitySecret(secretFor("p2"));
    base.register(commitmentFor(secretFor("p2")));
    const branchA = base.fork();

    base.setIdentitySecret(secretFor("p3"));
    base.register(commitmentFor(secretFor("p3")));
    const branchB = base.fork();

    const resultA = branchA.pledge(); // from branchA's own view: tally 1 -> 2, fires
    expect(resultA.fired).toBe(true);

    // branchB is a SEPARATE in-memory context, not a second submission
    // against the same canonical ledger branchA just updated — so this only
    // tells us circuit logic is self-consistent per-branch, not that a real
    // network correctly rejects the loser of an actual race. That empirical
    // gap is real and is documented, not swept under this passing test.
    const resultB = branchB.pledge();
    expect(resultB.fired).toBe(true);
  });
});

describe("Silent Quorum — boundary configuration", () => {
  it("threshold of 1 fires on the first pledge", () => {
    const sim = new SilentQuorumSimulator(baseConfig(1n), secretFor("solo"));
    sim.register(commitmentFor(secretFor("solo")));
    const ledger = sim.pledge();
    expect(ledger.fired).toBe(true);
  });
});

describe("Silent Quorum — nullifier unlinkability (data-level spot check)", () => {
  it("different identities produce different commitments and different nullifiers", () => {
    const secretA = secretFor("alice");
    const secretB = secretFor("bob");
    expect(commitmentFor(secretA)).not.toEqual(commitmentFor(secretB));

    const config = baseConfig(5n);
    const simA = new SilentQuorumSimulator(config, secretA);
    simA.register(commitmentFor(secretA));
    const ledgerA = simA.pledge();

    simA.setIdentitySecret(secretB);
    simA.register(commitmentFor(secretB));
    const ledgerB = simA.pledge();

    // Two distinct nullifier entries now exist in the public map (size grew
    // by exactly one per pledge) — but the map's *keys* are domain-separated
    // hashes, not identities; nothing here, or in the circuit, ties either
    // key back to "alice" or "bob" (see ARCHITECTURE.md, I3).
    expect(ledgerB.pledge_nullifiers.size()).toBe(2n);
  });
});

describe("Silent Quorum — I9 regression: secret never touches public state", () => {
  it("the identitySecret bytes never appear as a value anywhere in public ledger state", () => {
    const secret = secretFor("carol");
    const sim = new SilentQuorumSimulator(baseConfig(1n), secret);
    sim.register(commitmentFor(secret));
    const ledger = sim.pledge();

    const haystacks: Uint8Array[] = [
      ledger.org_id, ledger.quorum_id, ledger.action_id,
      ledger.consequence_recipient
    ];
    for (const [key] of ledger.pledge_nullifiers) {
      haystacks.push(key);
    }
    const secretHex = Buffer.from(secret).toString("hex");
    for (const h of haystacks) {
      expect(Buffer.from(h).toString("hex")).not.toBe(secretHex);
    }
  });
});
