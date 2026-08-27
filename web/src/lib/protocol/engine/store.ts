import "server-only";

// A single in-memory process holds every simulated contract instance for
// this demo — no database. State resets on server restart. That is a
// genuine, disclosed limitation of a hackathon-scale deployment (see
// README's "Known Limitations" in the frontend milestone report), not an
// attempt to hide it. Kept on `globalThis` so Next's dev-mode module
// reloading doesn't wipe state on every file save.
//
// This module is the ONLY place in the web app that touches the compiled
// contract simulators directly — everything else goes through
// lib/protocol/engine/*.ts's typed functions. That is the "protocol data
// vs. presentation vs. environment" separation called for in the brief.

import { SilentQuorumSimulator, type QuorumConfig } from "../../../../../contract/dist/quorum-core/simulator.js";
import { RegistrySimulator } from "../../../../../contract/dist/quorum-registry/simulator.js";
import { ClaimLedgerSimulator } from "../../../../../contract/dist/consequence-claim-ledger/simulator.js";

export interface QuorumRecord {
  id: string;
  code: string;
  name: string;
  summary: string;
  orgLabel: string;
  quorumLabel: string;
  actionLabel: string;
  consequenceRecipientLabel: string;
  issuerSecret: Uint8Array;
  sim: SilentQuorumSimulator;
  participantCount: number;
}

interface Store {
  quorums: Map<string, QuorumRecord>;
  registry: { sim: RegistrySimulator; operatorSecret: Uint8Array } | null;
  claims: { sim: ClaimLedgerSimulator; arbiterSecret: Uint8Array; recipientSecrets: Map<string, Uint8Array> } | null;
  seeded: boolean;
}

const g = globalThis as unknown as { __silentQuorumStore?: Store };

export function getStore(): Store {
  if (!g.__silentQuorumStore) {
    g.__silentQuorumStore = { quorums: new Map(), registry: null, claims: null, seeded: false };
  }
  return g.__silentQuorumStore;
}

export type { SilentQuorumSimulator, QuorumConfig, RegistrySimulator, ClaimLedgerSimulator };
