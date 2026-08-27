import "server-only";
import { bytesToHex, errorMessage } from "@/lib/utils";
import { claimIdFor, recipientCommitmentFor } from "../../../../../contract/dist/domain.js";
import { ensureSeeded } from "./seed";
import { getStore } from "./store";
import type { ClaimSnapshot } from "../types";

export function listClaimSnapshots(): ClaimSnapshot[] {
  ensureSeeded();
  const store = getStore();
  if (!store.claims) return [];
  const snapshots: ClaimSnapshot[] = [];
  for (const q of store.quorums.values()) {
    const ledger = q.sim.getLedger();
    const claimId = claimIdFor(ledger.org_id, ledger.quorum_id, ledger.action_id);
    if (!store.claims.sim.getLedger().claims.member(claimId)) continue;
    const record = store.claims.sim.getLedger().claims.lookup(claimId);
    snapshots.push({
      claimId: bytesToHex(claimId),
      orgLabel: q.orgLabel,
      quorumLabel: q.quorumLabel,
      actionLabel: q.actionLabel,
      linkedQuorumRouteId: q.id,
      recipientCommitment: bytesToHex(record.recipientCommitment),
      consequenceType: Number(record.consequenceType),
      status: record.status === 0 ? "claimed" : "disputed"
    });
  }
  return snapshots;
}

/** Quorums with no existing claim record yet — used to offer the
 * interactive claim ritual only against triples that are actually still
 * available to claim (submitting against an already-claimed triple would
 * just fail with "already claimed"). */
export function listUnclaimedQuorumIds(): string[] {
  ensureSeeded();
  const store = getStore();
  if (!store.claims) return [];
  const ids: string[] = [];
  for (const q of store.quorums.values()) {
    const ledger = q.sim.getLedger();
    const claimId = claimIdFor(ledger.org_id, ledger.quorum_id, ledger.action_id);
    if (!store.claims.sim.getLedger().claims.member(claimId)) ids.push(q.id);
  }
  return ids;
}

export type ClaimAction = { ok: true; snapshots: ClaimSnapshot[] } | { ok: false; error: string };

/** Submits a claim proving control of `recipientSecretHex` against the
 * given quorum's (org, quorum, action) triple. Deliberately does not check
 * whether that quorum fired — the Claim Ledger contract cannot either;
 * see consequence-claim-ledger.compact's header. */
export function submitClaim(quorumRouteId: string, recipientSecretHex: string, consequenceType = 1n): ClaimAction {
  ensureSeeded();
  const store = getStore();
  const q = store.quorums.get(quorumRouteId);
  if (!q || !store.claims) return { ok: false, error: "Unknown quorum." };
  try {
    const secret = Uint8Array.from(Buffer.from(recipientSecretHex, "hex"));
    const ledger = q.sim.getLedger();
    store.claims.sim.setRecipientSecret(secret);
    store.claims.sim.claim(ledger.org_id, ledger.quorum_id, ledger.action_id, recipientCommitmentFor(secret), consequenceType);
    return { ok: true, snapshots: listClaimSnapshots() };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Claim failed.") };
  }
}

export function disputeClaim(quorumRouteId: string, arbiterSecretHex: string): ClaimAction {
  ensureSeeded();
  const store = getStore();
  const q = store.quorums.get(quorumRouteId);
  if (!q || !store.claims) return { ok: false, error: "Unknown quorum." };
  try {
    const secret = Uint8Array.from(Buffer.from(arbiterSecretHex, "hex"));
    const ledger = q.sim.getLedger();
    store.claims.sim.setArbiterSecret(secret);
    store.claims.sim.dispute(ledger.org_id, ledger.quorum_id, ledger.action_id);
    return { ok: true, snapshots: listClaimSnapshots() };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Dispute failed.") };
  }
}
