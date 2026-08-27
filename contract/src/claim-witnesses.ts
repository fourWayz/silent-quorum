// Silent Quorum — Consequence Claim Ledger witness implementation.

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "./managed/consequence-claim-ledger/contract/index.js";

export type ClaimPrivateState = {
  readonly recipientSecret: Uint8Array;
  readonly arbiterSecret: Uint8Array;
};

export const createClaimPrivateState = (
  recipientSecret: Uint8Array,
  arbiterSecret: Uint8Array
): ClaimPrivateState => ({ recipientSecret, arbiterSecret });

export const claimWitnesses = {
  get_recipient_secret: ({
    privateState
  }: WitnessContext<Ledger, ClaimPrivateState>): [ClaimPrivateState, Uint8Array] => [
    privateState,
    privateState.recipientSecret
  ],
  get_arbiter_secret: ({
    privateState
  }: WitnessContext<Ledger, ClaimPrivateState>): [ClaimPrivateState, Uint8Array] => [
    privateState,
    privateState.arbiterSecret
  ]
};
