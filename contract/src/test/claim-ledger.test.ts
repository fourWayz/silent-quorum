import { describe, it, expect } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { ClaimLedgerSimulator } from "../claim-ledger-simulator.js";
import { b32, recipientCommitmentFor, arbiterCommitmentFor, claimIdFor } from "../domain.js";
import { ClaimStatus } from "../managed/consequence-claim-ledger/contract/index.js";

setNetworkId("undeployed");

const secretFor = (label: string): Uint8Array =>
  Uint8Array.from(Buffer.from(label.padEnd(32, "\0"), "utf8"));

const ARBITER_SECRET = secretFor("arbiter");
const ARBITER_COMMITMENT = arbiterCommitmentFor(ARBITER_SECRET);

const ORG = b32("org:acme");
const QUORUM = b32("quorum:q1");
const ACTION = b32("action:strike");

const newSim = (recipientSecret: Uint8Array) =>
  new ClaimLedgerSimulator(ARBITER_COMMITMENT, recipientSecret, ARBITER_SECRET);

describe("Consequence Claim Ledger — recipient ownership (I20)", () => {
  it("accepts a claim from the party who knows the recipient secret", () => {
    const recipientSecret = secretFor("recipient");
    const sim = newSim(recipientSecret);
    const commitment = recipientCommitmentFor(recipientSecret);
    expect(() => sim.claim(ORG, QUORUM, ACTION, commitment, 0n)).not.toThrow();
  });

  it("rejects a claim with the wrong secret against a real commitment", () => {
    const realSecret = secretFor("recipient");
    const commitment = recipientCommitmentFor(realSecret);
    const sim = newSim(secretFor("impostor"));
    expect(() => sim.claim(ORG, QUORUM, ACTION, commitment, 0n)).toThrow(/not the named recipient/);
  });

  it("rejects a claim against a commitment that doesn't match the supplied secret at all", () => {
    const sim = newSim(secretFor("recipient"));
    const unrelatedCommitment = b32("some-unrelated-value");
    expect(() => sim.claim(ORG, QUORUM, ACTION, unrelatedCommitment, 0n)).toThrow(/not the named recipient/);
  });
});

describe("Consequence Claim Ledger — one claim per consequence (I19)", () => {
  it("rejects a duplicate claim for the same (org, quorum, action)", () => {
    const recipientSecret = secretFor("recipient");
    const commitment = recipientCommitmentFor(recipientSecret);
    const sim = newSim(recipientSecret);
    sim.claim(ORG, QUORUM, ACTION, commitment, 0n);
    expect(() => sim.claim(ORG, QUORUM, ACTION, commitment, 0n)).toThrow(/already claimed/);
  });

  it("isolates claims across different quorums", () => {
    const recipientSecret = secretFor("recipient");
    const commitment = recipientCommitmentFor(recipientSecret);
    const sim = newSim(recipientSecret);
    sim.claim(ORG, QUORUM, ACTION, commitment, 0n);
    expect(() => sim.claim(ORG, b32("quorum:q2"), ACTION, commitment, 0n)).not.toThrow();
  });

  it("isolates claims across different actions", () => {
    const recipientSecret = secretFor("recipient");
    const commitment = recipientCommitmentFor(recipientSecret);
    const sim = newSim(recipientSecret);
    sim.claim(ORG, QUORUM, ACTION, commitment, 0n);
    expect(() => sim.claim(ORG, QUORUM, b32("action:other"), commitment, 0n)).not.toThrow();
  });

  it("isolates claims across different organizations", () => {
    const recipientSecret = secretFor("recipient");
    const commitment = recipientCommitmentFor(recipientSecret);
    const sim = newSim(recipientSecret);
    sim.claim(ORG, QUORUM, ACTION, commitment, 0n);
    expect(() => sim.claim(b32("org:other-co"), QUORUM, ACTION, commitment, 0n)).not.toThrow();
  });
});

describe("Consequence Claim Ledger — dispute (I22)", () => {
  it("the arbiter can dispute an existing claim", () => {
    const recipientSecret = secretFor("recipient");
    const commitment = recipientCommitmentFor(recipientSecret);
    const sim = newSim(recipientSecret);
    sim.claim(ORG, QUORUM, ACTION, commitment, 0n);
    sim.dispute(ORG, QUORUM, ACTION);
    const record = sim.lookup(claimIdFor(ORG, QUORUM, ACTION))!;
    expect(record.status).toBe(ClaimStatus.DISPUTED);
  });

  it("rejects a dispute from anyone but the arbiter", () => {
    const recipientSecret = secretFor("recipient");
    const commitment = recipientCommitmentFor(recipientSecret);
    const sim = newSim(recipientSecret);
    sim.claim(ORG, QUORUM, ACTION, commitment, 0n);
    sim.setArbiterSecret(secretFor("impostor"));
    expect(() => sim.dispute(ORG, QUORUM, ACTION)).toThrow(/not authorized arbiter/);
  });

  it("rejects disputing a claim that doesn't exist", () => {
    const sim = newSim(secretFor("recipient"));
    expect(() => sim.dispute(ORG, QUORUM, ACTION)).toThrow(/no such claim/);
  });

  it("dispute is one-way — no un-dispute circuit exists", () => {
    const recipientSecret = secretFor("recipient");
    const commitment = recipientCommitmentFor(recipientSecret);
    const sim = newSim(recipientSecret);
    sim.claim(ORG, QUORUM, ACTION, commitment, 0n);
    sim.dispute(ORG, QUORUM, ACTION);
    expect((sim.contract.impureCircuits as any).undispute).toBeUndefined();
  });
});

describe("Consequence Claim Ledger — malformed input", () => {
  it("a zero commitment is just an ordinary (non-matching) value, not a special case", () => {
    const sim = newSim(secretFor("recipient"));
    const zero = new Uint8Array(32);
    expect(() => sim.claim(ORG, QUORUM, ACTION, zero, 0n)).toThrow(/not the named recipient/);
  });
});

// ---------------------------------------------------------------------------
// THE DELIBERATELY UNCOMFORTABLE TEST.
//
// This is not a bug and not a missing check. Consequence Claim Ledger has no
// way to read Quorum Core's state (no cross-contract reads exist in Compact
// 0.31.1) and therefore CANNOT know whether the referenced quorum ever
// fired. This test proves that a structurally valid claim succeeds
// regardless — demonstrating the exact boundary of what this contract can
// and cannot enforce, on purpose, so nobody mistakes the omission for an
// oversight. See ARCHITECTURE.md, "cryptographically enforced vs.
// client-verified."
// ---------------------------------------------------------------------------
describe("Consequence Claim Ledger — cross-contract limitation, demonstrated not hidden", () => {
  it("accepts a valid ownership claim even though no Core instance for this quorum has fired, or exists at all", () => {
    const recipientSecret = secretFor("recipient");
    const commitment = recipientCommitmentFor(recipientSecret);
    const sim = newSim(recipientSecret);
    // No Quorum Core was ever constructed in this test. This claim is
    // "for" a quorum_id that, as far as this test is concerned, never
    // existed anywhere — and it still succeeds, because Claim Ledger
    // structurally cannot check otherwise.
    expect(() => sim.claim(ORG, b32("quorum:never-fired"), ACTION, commitment, 0n)).not.toThrow();
  });
});
