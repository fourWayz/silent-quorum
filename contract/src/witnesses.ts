// Silent Quorum — witness implementations.
//
// Both witnesses run locally, against the participant's own private state
// and the public ledger view they already have (via the indexer, or — here
// — the in-memory simulator). Neither identitySecret nor the membership
// path it derives is ever returned from a circuit to the ledger; only the
// `pledge` circuit's own disclose()d values (see silent-quorum.compact)
// ever leave the witness boundary.

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "./managed/silent-quorum/contract/index.js";
import { leafFor } from "./domain.js";

export type SilentQuorumPrivateState = {
  readonly identitySecret: Uint8Array;
  // Only the party who knows this secret can register/close/cancel — a
  // shared-secret role gate (no signature-verification API exists in
  // Compact 0.31.1; see ARCHITECTURE.md). Present alongside identitySecret
  // so one simulator/test actor can play either role as needed; on live
  // devnet the issuer and participants are ordinarily different wallets
  // with their own separate private state.
  readonly issuerSecret: Uint8Array;
};

export const createSilentQuorumPrivateState = (
  identitySecret: Uint8Array,
  issuerSecret: Uint8Array
): SilentQuorumPrivateState => ({ identitySecret, issuerSecret });

export const witnesses = {
  get_issuer_secret: ({
    privateState
  }: WitnessContext<Ledger, SilentQuorumPrivateState>): [
    SilentQuorumPrivateState,
    Uint8Array
  ] => [privateState, privateState.issuerSecret],

  get_identity_secret: ({
    privateState
  }: WitnessContext<Ledger, SilentQuorumPrivateState>): [
    SilentQuorumPrivateState,
    Uint8Array
  ] => [privateState, privateState.identitySecret],

  get_merkle_path: ({
    ledger,
    privateState
  }: WitnessContext<Ledger, SilentQuorumPrivateState>) => {
    const leaf = leafFor(privateState.identitySecret);
    const path = ledger.eligibility_tree.findPathForLeaf(leaf);
    if (path === undefined) {
      // Not registered — the circuit's own assert(path.leaf == leaf, ...)
      // and checkRoot(...) will reject this; we still have to return a
      // well-typed path shape here, since the witness can't itself throw a
      // circuit-level assertion failure.
      throw new Error("no eligibility commitment found for this identity");
    }
    return [privateState, path];
  }
};
