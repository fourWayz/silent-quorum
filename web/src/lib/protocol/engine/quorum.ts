import "server-only";
import { bytesToHex, errorMessage } from "@/lib/utils";
import { leafFor } from "../../../../../contract/dist/domain.js";
import { ensureSeeded } from "./seed";
import { getStore, type QuorumRecord } from "./store";
import type { QuorumSnapshot } from "../types";

function toSnapshot(record: QuorumRecord): QuorumSnapshot {
  const ledger = record.sim.getLedger();
  return {
    id: record.id,
    name: record.name,
    summary: record.summary,
    orgId: bytesToHex(ledger.org_id),
    quorumId: bytesToHex(ledger.quorum_id),
    actionId: bytesToHex(ledger.action_id),
    orgLabel: record.orgLabel,
    quorumLabel: record.quorumLabel,
    actionLabel: record.actionLabel,
    threshold: Number(ledger.threshold),
    tally: Number(ledger.tally),
    consequenceAmount: ledger.consequence_amount.toString(),
    consequenceRecipientLabel: record.consequenceRecipientLabel,
    consequenceRecipientCommitment: bytesToHex(ledger.consequence_recipient_commitment),
    issuerCommitment: bytesToHex(ledger.issuer_commitment),
    configCommitment: bytesToHex(ledger.config_commitment),
    protocolVersion: Number(ledger.protocol_version),
    fired: ledger.fired,
    cancelled: ledger.cancelled,
    registrationOpen: ledger.registration_open,
    participantCount: record.participantCount
  };
}

export function listQuorumSnapshots(): QuorumSnapshot[] {
  ensureSeeded();
  return [...getStore().quorums.values()].map(toSnapshot);
}

export function getQuorumSnapshot(id: string): QuorumSnapshot | null {
  ensureSeeded();
  const record = getStore().quorums.get(id);
  return record ? toSnapshot(record) : null;
}

export type ParticipantAction =
  | { ok: true; snapshot: QuorumSnapshot; justFired: boolean }
  | { ok: false; error: string };

/** Registers the caller's identity commitment (derived server-side from a
 * secret the browser generated and sent along) and returns the updated
 * public snapshot. The secret itself is held only for the duration of this
 * call and is never written to the snapshot or logged. */
export function registerParticipant(quorumId: string, identitySecretHex: string): ParticipantAction {
  ensureSeeded();
  const record = getStore().quorums.get(quorumId);
  if (!record) return { ok: false, error: "Unknown quorum." };
  try {
    const secret = Uint8Array.from(Buffer.from(identitySecretHex, "hex"));
    record.sim.setIdentitySecret(secret);
    record.sim.register(leafFor(secret));
    record.participantCount += 1;
    return { ok: true, snapshot: toSnapshot(record), justFired: false };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Registration failed.") };
  }
}

export function submitPledge(quorumId: string, identitySecretHex: string): ParticipantAction {
  ensureSeeded();
  const record = getStore().quorums.get(quorumId);
  if (!record) return { ok: false, error: "Unknown quorum." };
  try {
    const secret = Uint8Array.from(Buffer.from(identitySecretHex, "hex"));
    const wasFired = record.sim.getLedger().fired;
    record.sim.setIdentitySecret(secret);
    record.sim.pledge();
    const snapshot = toSnapshot(record);
    return { ok: true, snapshot, justFired: !wasFired && snapshot.fired };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Pledge failed.") };
  }
}

/** Read-only check the console UI uses before offering the "Pledge" step —
 * mirrors what the real witness does (findPathForLeaf) without mutating
 * anything, so the ritual UI can tell "not yet registered" apart from
 * "registered, ready to pledge" without spending a real circuit call. */
export function isRegistered(quorumId: string, identitySecretHex: string): boolean {
  ensureSeeded();
  const record = getStore().quorums.get(quorumId);
  if (!record) return false;
  const secret = Uint8Array.from(Buffer.from(identitySecretHex, "hex"));
  const leaf = leafFor(secret);
  return record.sim.getLedger().eligibility_tree.findPathForLeaf(leaf) !== undefined;
}
