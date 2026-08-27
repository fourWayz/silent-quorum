// Silent Quorum — Consequence Claim Ledger local circuit simulator.

import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  type ClaimRecord
} from "./managed/consequence-claim-ledger/contract/index.js";
import { type ClaimPrivateState, claimWitnesses } from "./claim-witnesses.js";

export class ClaimLedgerSimulator {
  readonly contract: Contract<ClaimPrivateState>;
  circuitContext: CircuitContext<ClaimPrivateState>;

  constructor(arbiterCommitment: Uint8Array, recipientSecret: Uint8Array, arbiterSecret: Uint8Array) {
    this.contract = new Contract<ClaimPrivateState>(claimWitnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({ recipientSecret, arbiterSecret }, "0".repeat(64)),
        arbiterCommitment
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

  public setRecipientSecret(recipientSecret: Uint8Array): void {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { ...this.circuitContext.currentPrivateState, recipientSecret }
    };
  }

  public setArbiterSecret(arbiterSecret: Uint8Array): void {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { ...this.circuitContext.currentPrivateState, arbiterSecret }
    };
  }

  public claim(
    orgId: Uint8Array,
    quorumId: Uint8Array,
    actionId: Uint8Array,
    recipientCommitment: Uint8Array,
    consequenceType: bigint
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits.claim(
      this.circuitContext,
      orgId,
      quorumId,
      actionId,
      recipientCommitment,
      consequenceType
    ).context;
    return this.getLedger();
  }

  public dispute(orgId: Uint8Array, quorumId: Uint8Array, actionId: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.dispute(
      this.circuitContext,
      orgId,
      quorumId,
      actionId
    ).context;
    return this.getLedger();
  }

  public lookup(claimId: Uint8Array): ClaimRecord | undefined {
    const l = this.getLedger();
    return l.claims.member(claimId) ? l.claims.lookup(claimId) : undefined;
  }

  // Same caveat as the other two simulators: sequential-application only.
  public fork(): ClaimLedgerSimulator {
    const clone = Object.create(ClaimLedgerSimulator.prototype) as ClaimLedgerSimulator;
    (clone as any).contract = this.contract;
    clone.circuitContext = { ...this.circuitContext };
    return clone;
  }
}
