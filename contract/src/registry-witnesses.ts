// Silent Quorum — Quorum Registry witness implementation.
//
// The operator secret never touches ledger state — the same shared-secret
// role-gate pattern as Core's issuer authorization (see domain.ts).

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "./managed/quorum-registry/contract/index.js";

export type RegistryPrivateState = {
  readonly operatorSecret: Uint8Array;
};

export const createRegistryPrivateState = (operatorSecret: Uint8Array): RegistryPrivateState => ({
  operatorSecret
});

export const registryWitnesses = {
  get_operator_secret: ({
    privateState
  }: WitnessContext<Ledger, RegistryPrivateState>): [RegistryPrivateState, Uint8Array] => [
    privateState,
    privateState.operatorSecret
  ]
};
