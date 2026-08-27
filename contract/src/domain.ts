// Silent Quorum — shared hash helpers for tests and off-chain clients.
//
// Every tag here must match its Compact-side pad(32, "...") literal exactly.
// Duplicated intentionally (the witness/test runtime has no access to
// Compact constants) — kept in one module so the three contracts' tests
// can't drift out of sync with each other, even though they can still
// drift from the .compact source itself. Any change to a tag on the
// Compact side must be mirrored here by hand.

import {
  persistentHash,
  CompactTypeVector,
  Bytes32Descriptor
} from "@midnight-ntwrk/compact-runtime";

const tag = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s.padEnd(32, "\0"), "utf8"));
const pairOfBytes32 = new CompactTypeVector(2, Bytes32Descriptor);
const nonetOfBytes32 = new CompactTypeVector(9, Bytes32Descriptor);
const quartetOfBytes32 = new CompactTypeVector(4, Bytes32Descriptor);

export const b32 = (label: string): Uint8Array => tag(label);

// --- Quorum Core ---
export const leafFor = (identitySecret: Uint8Array): Uint8Array =>
  persistentHash(pairOfBytes32, [tag("silent-quorum:leaf:"), identitySecret]);

export const issuerCommitmentFor = (issuerSecret: Uint8Array): Uint8Array =>
  persistentHash(pairOfBytes32, [tag("silent-quorum:issuer:"), issuerSecret]);

export const pledgeDomainFor = (orgId: Uint8Array, quorumId: Uint8Array, actionId: Uint8Array): Uint8Array =>
  persistentHash(quartetOfBytes32, [tag("silent-quorum:domain:"), orgId, quorumId, actionId]);

export const pledgeNullifierFor = (identitySecret: Uint8Array, domain: Uint8Array): Uint8Array =>
  persistentHash(pairOfBytes32, [identitySecret, domain]);

const u64le = (n: bigint): Uint8Array => {
  const buf = Buffer.alloc(32);
  buf.writeBigUInt64LE(n & 0xffffffffffffffffn, 0);
  return Uint8Array.from(buf);
};
const u32le = (n: bigint): Uint8Array => u64le(n);
const u16le = (n: bigint): Uint8Array => u64le(n);

export function configCommitmentFor(cfg: {
  orgId: Uint8Array;
  quorumId: Uint8Array;
  actionId: Uint8Array;
  threshold: bigint;
  issuerCommitment: Uint8Array;
  recipientCommitment: Uint8Array;
  amount: bigint;
  protocolVersion: bigint;
}): Uint8Array {
  // NOTE: this mirrors `threshold as Field as Bytes<32>` etc. on the Compact
  // side. The exact byte layout Field-casting produces was NOT re-derived
  // from first principles here — it's whatever the test run itself observes
  // by comparing against Core's on-chain config_commitment (see
  // silent-quorum.test.ts's "deterministic config commitment" test, which
  // is the actual empirical check, not this function in isolation).
  return persistentHash(nonetOfBytes32, [
    tag("silent-quorum:config:"),
    cfg.orgId,
    cfg.quorumId,
    cfg.actionId,
    u32le(cfg.threshold),
    cfg.issuerCommitment,
    cfg.recipientCommitment,
    u64le(cfg.amount),
    u16le(cfg.protocolVersion)
  ]);
}

// --- Consequence Claim Ledger ---
export const recipientCommitmentFor = (recipientSecret: Uint8Array): Uint8Array =>
  persistentHash(pairOfBytes32, [tag("claim-ledger:recipient:"), recipientSecret]);

// The map key in consequence-claim-ledger.compact — public by construction
// (a caller must supply org/quorum/action to look anything up), so unlike
// Core's pledge nullifier this needs no secret-derived component. See the
// contract's own header comment for why.
export const claimIdFor = (orgId: Uint8Array, quorumId: Uint8Array, actionId: Uint8Array): Uint8Array =>
  persistentHash(quartetOfBytes32, [tag("claim-ledger:domain:"), orgId, quorumId, actionId]);

export const arbiterCommitmentFor = (arbiterSecret: Uint8Array): Uint8Array =>
  persistentHash(pairOfBytes32, [tag("claim-ledger:arbiter:"), arbiterSecret]);

// --- Quorum Registry ---
export const operatorCommitmentFor = (operatorSecret: Uint8Array): Uint8Array =>
  persistentHash(pairOfBytes32, [tag("quorum-registry:operator:"), operatorSecret]);
