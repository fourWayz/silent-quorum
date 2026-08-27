import { describe, it, expect } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { RegistrySimulator, addressFor } from "../simulator.js";
import { operatorCommitmentFor, b32 } from "../../domain.js";
import { QuorumStatus } from "../managed/contract/index.js";

setNetworkId("undeployed");

const secretFor = (label: string): Uint8Array =>
  Uint8Array.from(Buffer.from(label.padEnd(32, "\0"), "utf8"));

const OPERATOR_SECRET = secretFor("registry-operator");
const OPERATOR_COMMITMENT = operatorCommitmentFor(OPERATOR_SECRET);

const newSim = () => new RegistrySimulator(OPERATOR_COMMITMENT, OPERATOR_SECRET);

describe("Quorum Registry — operator authorization", () => {
  it("accepts registration from the real operator", () => {
    const sim = newSim();
    expect(() =>
      sim.registerQuorum(b32("quorum:q1"), addressFor("core:q1"), b32("config:q1"))
    ).not.toThrow();
  });

  it("rejects registration from anyone else", () => {
    const sim = newSim();
    sim.setOperatorSecret(secretFor("impostor"));
    expect(() =>
      sim.registerQuorum(b32("quorum:q1"), addressFor("core:q1"), b32("config:q1"))
    ).toThrow(/not authorized operator/);
  });

  it("rejects deactivation from anyone but the operator", () => {
    const sim = newSim();
    sim.registerQuorum(b32("quorum:q1"), addressFor("core:q1"), b32("config:q1"));
    sim.setOperatorSecret(secretFor("impostor"));
    expect(() => sim.deactivateQuorum(b32("quorum:q1"))).toThrow(/not authorized operator/);
  });
});

describe("Quorum Registry — first-write-wins / append-only (I16)", () => {
  it("rejects a duplicate quorumId", () => {
    const sim = newSim();
    sim.registerQuorum(b32("quorum:q1"), addressFor("core:q1"), b32("config:q1"));
    expect(() =>
      sim.registerQuorum(b32("quorum:q1"), addressFor("core:other"), b32("config:other"))
    ).toThrow(/already registered/);
  });

  it("the original record is untouched after a rejected duplicate attempt", () => {
    const sim = newSim();
    sim.registerQuorum(b32("quorum:q1"), addressFor("core:q1"), b32("config:q1"));
    try {
      sim.registerQuorum(b32("quorum:q1"), addressFor("core:other"), b32("config:other"));
    } catch {
      /* expected */
    }
    const record = sim.lookup(b32("quorum:q1"))!;
    expect(Buffer.from(record.coreAddress.bytes).toString("hex")).toBe(
      Buffer.from(addressFor("core:q1").bytes).toString("hex")
    );
  });

  it("the same coreAddress may legitimately back two different quorumIds", () => {
    const sim = newSim();
    const sharedAddress = addressFor("core:shared");
    expect(() => sim.registerQuorum(b32("quorum:a"), sharedAddress, b32("config:a"))).not.toThrow();
    expect(() => sim.registerQuorum(b32("quorum:b"), sharedAddress, b32("config:b"))).not.toThrow();
  });
});

describe("Quorum Registry — deactivation (I18)", () => {
  it("deactivates an existing entry", () => {
    const sim = newSim();
    sim.registerQuorum(b32("quorum:q1"), addressFor("core:q1"), b32("config:q1"));
    sim.deactivateQuorum(b32("quorum:q1"));
    expect(sim.lookup(b32("quorum:q1"))!.status).toBe(QuorumStatus.DEACTIVATED);
  });

  it("rejects deactivating an unknown quorumId", () => {
    const sim = newSim();
    expect(() => sim.deactivateQuorum(b32("quorum:ghost"))).toThrow(/unknown quorum/);
  });

  it("has no reactivate circuit — deactivation is one-way", () => {
    const sim = newSim();
    sim.registerQuorum(b32("quorum:q1"), addressFor("core:q1"), b32("config:q1"));
    sim.deactivateQuorum(b32("quorum:q1"));
    // Confirm no method on the contract's circuit surface can reverse this —
    // the only way back would be a circuit this contract simply doesn't have.
    expect((sim.contract.impureCircuits as any).reactivate_quorum).toBeUndefined();
    expect(sim.lookup(b32("quorum:q1"))!.status).toBe(QuorumStatus.DEACTIVATED);
  });

  it("preserves coreAddress and configCommitment across deactivation", () => {
    const sim = newSim();
    sim.registerQuorum(b32("quorum:q1"), addressFor("core:q1"), b32("config:q1"));
    sim.deactivateQuorum(b32("quorum:q1"));
    const record = sim.lookup(b32("quorum:q1"))!;
    expect(Buffer.from(record.coreAddress.bytes).toString("hex")).toBe(
      Buffer.from(addressFor("core:q1").bytes).toString("hex")
    );
    expect(Buffer.from(record.configCommitment).toString("hex")).toBe(
      Buffer.from(b32("config:q1")).toString("hex")
    );
  });
});

describe("Quorum Registry — discovery", () => {
  it("an unregistered quorumId is simply absent, not an error", () => {
    const sim = newSim();
    expect(sim.lookup(b32("quorum:nonexistent"))).toBeUndefined();
  });

  it("a fresh registry starts empty", () => {
    const sim = newSim();
    expect(sim.getLedger().quorums.isEmpty()).toBe(true);
  });
});
