// Silent Quorum — witness implementations.
//
// Both witnesses run locally, against the participant's own private state
// and the public ledger view they already have (via the indexer, or — here
// — the in-memory simulator). Neither identitySecret nor the membership
// path it derives is ever returned from a circuit to the ledger; only the
// `pledge` circuit's own disclose()d values (see silent-quorum.compact)
// ever leave the witness boundary.

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import {
  persistentHash,
  CompactTypeVector,
  Bytes32Descriptor
} from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "./managed/silent-quorum/contract/index.js";

export type SilentQuorumPrivateState = {
  readonly identitySecret: Uint8Array;
};

export const createSilentQuorumPrivateState = (
  identitySecret: Uint8Array
): SilentQuorumPrivateState => ({ identitySecret });

// Must match the Compact-side tag used in silent-quorum.compact's leaf hash
// exactly, including whatever byte-padding pad(32, ...) produces there —
// this is deliberately duplicated here rather than imported, because the
// witness runs in a different language/runtime than the circuit and has no
// access to Compact constants. VERIFIED empirically against the real
// compiled contract in silent-quorum.test.ts, not assumed correct by
// inspection alone — see ARCHITECTURE.md for the result.
const LEAF_TAG = Uint8Array.from(
  Buffer.from("silent-quorum:leaf:".padEnd(32, "\0"), "utf8")
);

const pairOfBytes32 = new CompactTypeVector(2, Bytes32Descriptor);

function leafFor(identitySecret: Uint8Array): Uint8Array {
  return persistentHash(pairOfBytes32, [LEAF_TAG, identitySecret]);
}

export const witnesses = {
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
