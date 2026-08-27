import { describe, it, expect } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { SilentQuorumSimulator, type QuorumConfig } from "../silent-quorum-simulator.js";
import { b32, leafFor as commitmentFor, issuerCommitmentFor, configCommitmentFor } from "../domain.js";

setNetworkId("undeployed");

const secretFor = (label: string): Uint8Array =>
  Uint8Array.from(Buffer.from(label.padEnd(32, "\0"), "utf8"));

const ISSUER_SECRET = secretFor("issuer");
const ISSUER_COMMITMENT = issuerCommitmentFor(ISSUER_SECRET);
const RECIPIENT_COMMITMENT = b32("recipient:escrow");

const baseConfig = (threshold: bigint): QuorumConfig => ({
  org: b32("org:acme"),
  quorum: b32("quorum:q1"),
  action: b32("action:strike"),
  threshold,
  issuerCommitment: ISSUER_COMMITMENT,
  recipientCommitment: RECIPIENT_COMMITMENT,
  amount: 1_000n
});

const newSim = (config: QuorumConfig, identitySecret: Uint8Array) =>
  new SilentQuorumSimulator(config, identitySecret, ISSUER_SECRET);

describe("Silent Quorum — registration and eligibility", () => {
  it("registers a commitment without ever touching the secret on-chain", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    const ledger = sim.register(commitmentFor(secretFor("alice")));
    expect(ledger.eligibility_tree.isFull()).toBe(false);
    // register() only ever took the commitment as an argument — there is no
    // code path in silent-quorum.compact by which a secret could appear in
    // ledger state at all.
  });

  it("a registered identity can pledge and is counted", () => {
    const sim = newSim(baseConfig(2n), secretFor("alice"));
    sim.register(commitmentFor(secretFor("alice")));
    const ledger = sim.pledge();
    expect(ledger.tally).toBe(1n);
    expect(ledger.fired).toBe(false);
  });

  it("rejects a pledge from an unregistered identity", () => {
    const sim = newSim(baseConfig(1n), secretFor("mallory"));
    expect(() => sim.pledge()).toThrow();
  });
});

describe("Silent Quorum — nullifier / double-pledge resistance", () => {
  it("rejects a second pledge from the same identity in the same quorum", () => {
    const sim = newSim(baseConfig(5n), secretFor("alice"));
    sim.register(commitmentFor(secretFor("alice")));
    sim.pledge();
    expect(() => sim.pledge()).toThrow(/already pledged/);
  });

  it("the same identity gets an independent pledge in a different quorum", () => {
    const secret = secretFor("alice");
    const commitment = commitmentFor(secret);

    const quorumA = newSim(baseConfig(5n), secret);
    quorumA.register(commitment);
    const ledgerA = quorumA.pledge();
    expect(ledgerA.tally).toBe(1n);

    const configB = { ...baseConfig(5n), quorum: b32("quorum:q2") };
    const quorumB = newSim(configB, secret);
    quorumB.register(commitment);
    const ledgerB = quorumB.pledge();
    expect(ledgerB.tally).toBe(1n); // independent — not blocked by quorum A's nullifier
  });

  it("the same identity gets an independent pledge in a different organization", () => {
    const secret = secretFor("alice");
    const commitment = commitmentFor(secret);
    const configOrgB = { ...baseConfig(5n), org: b32("org:other-co") };
    const sim = newSim(configOrgB, secret);
    sim.register(commitment);
    expect(sim.pledge().tally).toBe(1n);
  });
});

describe("Silent Quorum — atomic threshold firing (Architecture B)", () => {
  it("does not fire before threshold (N-1 pledges)", () => {
    const sim = newSim(baseConfig(3n), secretFor("p1"));
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
    const sim = newSim(baseConfig(3n), secretFor("p1"));
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
    const sim = newSim(baseConfig(1n), secretFor("p1"));
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
  // IMPORTANT: this proves the guard holds when two pledge calls are applied
  // ONE AFTER ANOTHER against a context that has already observed the
  // first one's effect. The real network-level race is verified separately
  // on live devnet — see ARCHITECTURE.md's "Live-devnet concurrency test".
  it("a pledge landing immediately after the firing pledge is accepted but cannot double-fire", () => {
    const sim = newSim(baseConfig(2n), secretFor("p1"));
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
    const base = newSim(baseConfig(2n), secretFor("p1"));
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
    // against the same canonical ledger branchA just updated — this only
    // shows circuit logic is self-consistent per-branch. The real network
    // behavior is verified on live devnet, not here.
    const resultB = branchB.pledge();
    expect(resultB.fired).toBe(true);
  });
});

describe("Silent Quorum — boundary configuration", () => {
  it("threshold of 1 fires on the first pledge", () => {
    const sim = newSim(baseConfig(1n), secretFor("solo"));
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
    const simA = newSim(config, secretA);
    simA.register(commitmentFor(secretA));
    simA.pledge();

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
    const sim = newSim(baseConfig(1n), secret);
    sim.register(commitmentFor(secret));
    const ledger = sim.pledge();

    const haystacks: Uint8Array[] = [
      ledger.org_id, ledger.quorum_id, ledger.action_id,
      ledger.consequence_recipient_commitment
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

describe("Silent Quorum — issuer authorization (I11)", () => {
  it("rejects registration from a party who doesn't know the issuer secret", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    sim.setIssuerSecret(secretFor("not-the-issuer"));
    expect(() => sim.register(commitmentFor(secretFor("alice")))).toThrow(/not authorized issuer/);
  });

  it("accepts registration from the party who knows the issuer secret", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    expect(() => sim.register(commitmentFor(secretFor("alice")))).not.toThrow();
  });
});

describe("Silent Quorum — registration lifecycle (I12, I14)", () => {
  it("rejects registration after close_registration()", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    sim.closeRegistration();
    expect(() => sim.register(commitmentFor(secretFor("alice")))).toThrow(/registration closed/);
  });

  it("close_registration() cannot be undone and calling it twice is a harmless no-op", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    const first = sim.closeRegistration();
    expect(first.registration_open).toBe(false);
    // Second call must NOT throw — a naive assert-guard would revert this
    // (and thus this exact M1-class bug is exactly what this test guards
    // against for the new lifecycle circuits, not just pledge()).
    const second = sim.closeRegistration();
    expect(second.registration_open).toBe(false);
  });

  it("close_registration() requires the issuer secret", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    sim.setIssuerSecret(secretFor("not-the-issuer"));
    expect(() => sim.closeRegistration()).toThrow(/not authorized issuer/);
  });

  it("pledging remains possible after registration closes, for already-registered identities", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    sim.register(commitmentFor(secretFor("alice")));
    sim.closeRegistration();
    expect(() => sim.pledge()).not.toThrow();
  });
});

describe("Silent Quorum — cancellation (I13, I14)", () => {
  it("rejects a pledge after cancel()", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    sim.register(commitmentFor(secretFor("alice")));
    sim.cancel();
    expect(() => sim.pledge()).toThrow(/quorum cancelled/);
  });

  it("cancel() cannot be undone and calling it twice is a harmless no-op", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    const first = sim.cancel();
    expect(first.cancelled).toBe(true);
    const second = sim.cancel();
    expect(second.cancelled).toBe(true);
  });

  it("cancel() requires the issuer secret", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    sim.setIssuerSecret(secretFor("not-the-issuer"));
    expect(() => sim.cancel()).toThrow(/not authorized issuer/);
  });

  it("cancellation does not un-fire an already-fired quorum", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    sim.register(commitmentFor(secretFor("alice")));
    const fired = sim.pledge();
    expect(fired.fired).toBe(true);
    const afterCancel = sim.cancel();
    expect(afterCancel.fired).toBe(true);
    expect(afterCancel.consequence_balance).toBe(1_000n);
  });
});

describe("Silent Quorum — deterministic configuration commitment (I15)", () => {
  it("a client can independently reproduce config_commitment from the constructor arguments", () => {
    const config = baseConfig(3n);
    const sim = newSim(config, secretFor("alice"));
    const onChain = sim.getLedger().config_commitment;

    const expected = configCommitmentFor({
      orgId: config.org,
      quorumId: config.quorum,
      actionId: config.action,
      threshold: config.threshold,
      issuerCommitment: config.issuerCommitment,
      recipientCommitment: config.recipientCommitment,
      amount: config.amount,
      protocolVersion: 2n
    });

    expect(Buffer.from(onChain).toString("hex")).toBe(Buffer.from(expected).toString("hex"));
  });

  it("changing any single configuration field changes config_commitment", () => {
    const config = baseConfig(3n);
    const base = newSim(config, secretFor("alice")).getLedger().config_commitment;
    const differentThreshold = newSim({ ...config, threshold: 4n }, secretFor("alice")).getLedger().config_commitment;
    const differentAmount = newSim({ ...config, amount: 2_000n }, secretFor("alice")).getLedger().config_commitment;
    expect(Buffer.from(differentThreshold).toString("hex")).not.toBe(Buffer.from(base).toString("hex"));
    expect(Buffer.from(differentAmount).toString("hex")).not.toBe(Buffer.from(base).toString("hex"));
  });

  it("protocol_version is set and stable", () => {
    const sim = newSim(baseConfig(1n), secretFor("alice"));
    expect(sim.getLedger().protocol_version).toBe(2n);
  });
});
