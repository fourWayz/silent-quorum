// Shared protocol-facing types. These describe the actual ledger shapes
// exposed by the three Compact contracts (see ARCHITECTURE.md) — this file
// has no rendering logic and no environment logic. Presentation lives in
// components/, environment/integration logic lives in lib/protocol/engine
// and lib/protocol/environment.ts.

export type EnvironmentKind = "simulator" | "demo" | "local-devnet" | "unconfigured";

export interface EnvironmentInfo {
  kind: EnvironmentKind;
  label: string;
  description: string;
}

/** The three independent lifecycle flags a Core contract actually exposes.
 * Deliberately not collapsed into a single enum — registration_open,
 * fired, and cancelled are independent booleans on-chain (see
 * silent-quorum.compact), and forcing them into one status would
 * misrepresent states the real contract can be in (e.g. fired AND still
 * registration_open). `primaryStatus` below derives one headline label
 * for the UI without hiding the underlying flags. */
export interface QuorumFlags {
  fired: boolean;
  cancelled: boolean;
  registrationOpen: boolean;
}

export type QuorumPrimaryStatus = "fired" | "cancelled" | "active";

export function primaryStatus(flags: QuorumFlags): QuorumPrimaryStatus {
  if (flags.fired) return "fired";
  if (flags.cancelled) return "cancelled";
  return "active";
}

/** Orders quorums so the one closest to firing leads — the intended demo
 * path opens on the quorum a judge can push over the threshold
 * themselves, not on whichever happened to seed first. Purely a display
 * ordering; carries no on-chain meaning. */
export function sortQuorumsForShowcase(quorums: QuorumSnapshot[]): QuorumSnapshot[] {
  const rank = (q: QuorumSnapshot): number => {
    const status = primaryStatus(q);
    if (status === "active") return 0;
    if (status === "fired") return 1;
    return 2; // cancelled
  };
  return [...quorums].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.threshold - a.tally - (b.threshold - b.tally);
  });
}

export interface QuorumSnapshot extends QuorumFlags {
  id: string; // stable slug used for routing — not on-chain
  name: string; // human label for the demo narrative — not on-chain
  summary: string;
  orgId: string; // hex
  quorumId: string; // hex
  actionId: string; // hex
  orgLabel: string;
  quorumLabel: string;
  actionLabel: string;
  threshold: number;
  tally: number;
  consequenceAmount: string; // bigint rendered as string — an opaque recorded value, not DUST or any real token
  consequenceRecipientLabel: string;
  consequenceRecipientCommitment: string; // hex
  issuerCommitment: string; // hex
  configCommitment: string; // hex
  protocolVersion: number;
  participantCount: number; // registered identities — metadata only, not a privacy leak (already public via tree size)
}

export type RegistryStatus = "active" | "deactivated";

export interface RegistryEntry {
  quorumId: string; // hex
  quorumLabel: string;
  linkedQuorumRouteId: string | null;
  coreAddressLabel: string;
  configCommitment: string; // hex, as claimed by the operator
  coreConfigCommitment: string | null; // hex, read directly from the linked Core instance, for client-side comparison only
  status: RegistryStatus;
}

export type ClaimStatus = "claimed" | "disputed";

export interface ClaimSnapshot {
  claimId: string; // hex
  orgLabel: string;
  quorumLabel: string;
  actionLabel: string;
  linkedQuorumRouteId: string | null;
  recipientCommitment: string; // hex
  consequenceType: number;
  status: ClaimStatus;
}
