// Silent Quorum — Quorum Registry local circuit simulator.
// Same pattern as quorum-core/simulator.ts.

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
  type QuorumRecord
} from "./managed/contract/index.js";
import { type RegistryPrivateState, registryWitnesses } from "./witnesses.js";

export type ContractAddressLike = { bytes: Uint8Array };

export const addressFor = (label: string): ContractAddressLike => ({
  bytes: Uint8Array.from(Buffer.from(label.padEnd(32, "\0"), "utf8"))
});

export class RegistrySimulator {
  readonly contract: Contract<RegistryPrivateState>;
  circuitContext: CircuitContext<RegistryPrivateState>;

  constructor(operatorCommitment: Uint8Array, operatorSecret: Uint8Array) {
    this.contract = new Contract<RegistryPrivateState>(registryWitnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({ operatorSecret }, "0".repeat(64)),
        operatorCommitment
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

  public setOperatorSecret(operatorSecret: Uint8Array): void {
    this.circuitContext = { ...this.circuitContext, currentPrivateState: { operatorSecret } };
  }

  public registerQuorum(quorumId: Uint8Array, coreAddress: ContractAddressLike, configCommitment: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.register_quorum(
      this.circuitContext,
      quorumId,
      coreAddress,
      configCommitment
    ).context;
    return this.getLedger();
  }

  public deactivateQuorum(quorumId: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.deactivate_quorum(
      this.circuitContext,
      quorumId
    ).context;
    return this.getLedger();
  }

  public lookup(quorumId: Uint8Array): QuorumRecord | undefined {
    const l = this.getLedger();
    return l.quorums.member(quorumId) ? l.quorums.lookup(quorumId) : undefined;
  }

  // Same caveat as SilentQuorumSimulator.fork(): sequential-application only,
  // not a model of real network concurrency. See registry-race.ts for the
  // live-devnet equivalent.
  public fork(): RegistrySimulator {
    const clone = Object.create(RegistrySimulator.prototype) as RegistrySimulator;
    (clone as any).contract = this.contract;
    clone.circuitContext = { ...this.circuitContext };
    return clone;
  }
}
