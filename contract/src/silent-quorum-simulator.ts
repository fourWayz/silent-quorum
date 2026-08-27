// Silent Quorum — local circuit simulator for tests.
//
// Pattern copied directly from midnightntwrk/example-counter's
// counter-simulator.ts, which is the official reference for driving a
// compiled Compact contract's circuits against @midnight-ntwrk/compact-runtime
// without a live network. This executes the real compiled contract output
// (src/managed/silent-quorum), not a hand-written mock.

import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger
} from "./managed/silent-quorum/contract/index.js";
import {
  type SilentQuorumPrivateState,
  witnesses
} from "./witnesses.js";

export type QuorumConfig = {
  org: Uint8Array;
  quorum: Uint8Array;
  action: Uint8Array;
  threshold: bigint;
  issuerCommitment: Uint8Array;
  recipientCommitment: Uint8Array;
  amount: bigint;
};

export class SilentQuorumSimulator {
  readonly contract: Contract<SilentQuorumPrivateState>;
  circuitContext: CircuitContext<SilentQuorumPrivateState>;

  constructor(config: QuorumConfig, identitySecret: Uint8Array, issuerSecret: Uint8Array) {
    this.contract = new Contract<SilentQuorumPrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({ identitySecret, issuerSecret }, "0".repeat(64)),
        config.org,
        config.quorum,
        config.action,
        config.threshold,
        config.issuerCommitment,
        config.recipientCommitment,
        config.amount
      );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public setIdentitySecret(identitySecret: Uint8Array): void {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { ...this.circuitContext.currentPrivateState, identitySecret }
    };
  }

  public setIssuerSecret(issuerSecret: Uint8Array): void {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { ...this.circuitContext.currentPrivateState, issuerSecret }
    };
  }

  public register(identityCommitment: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.register(
      this.circuitContext,
      identityCommitment
    ).context;
    return this.getLedger();
  }

  public closeRegistration(): Ledger {
    this.circuitContext = this.contract.impureCircuits.close_registration(this.circuitContext).context;
    return this.getLedger();
  }

  public cancel(): Ledger {
    this.circuitContext = this.contract.impureCircuits.cancel(this.circuitContext).context;
    return this.getLedger();
  }

  public pledge(): Ledger {
    this.circuitContext = this.contract.impureCircuits.pledge(
      this.circuitContext
    ).context;
    return this.getLedger();
  }

  // IMPORTANT, and the reason this method exists at all: this in-process
  // harness (the same pattern midnightntwrk/example-counter uses) executes
  // circuit calls sequentially against one mutable context — it has no
  // concept of two independently-proved transactions racing against a live
  // network. `fork()` can only simulate "two proofs built from an identical
  // starting snapshot, then applied one after another" — NOT "two proofs
  // submitted concurrently to a real ledger, whichever one the network
  // orders first." The real race condition requires an actual node/indexer
  // to observe — see ARCHITECTURE.md's "Live-devnet concurrency test".
  public fork(): SilentQuorumSimulator {
    const clone = Object.create(SilentQuorumSimulator.prototype) as SilentQuorumSimulator;
    (clone as any).contract = this.contract;
    clone.circuitContext = { ...this.circuitContext };
    return clone;
  }
}
