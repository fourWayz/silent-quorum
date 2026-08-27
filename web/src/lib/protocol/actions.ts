"use server";

import { registerParticipant, submitPledge, isRegistered, getQuorumSnapshot } from "./engine/quorum";
import { submitClaim, disputeClaim, listClaimSnapshots, listUnclaimedQuorumIds } from "./engine/claims";
import { checkLocalDevnet, type DevnetStatus } from "./environment";
import type { ParticipantAction } from "./engine/quorum";
import type { ClaimAction } from "./engine/claims";

export async function registerAction(quorumId: string, identitySecretHex: string): Promise<ParticipantAction> {
  return registerParticipant(quorumId, identitySecretHex);
}

export async function pledgeAction(quorumId: string, identitySecretHex: string): Promise<ParticipantAction> {
  return submitPledge(quorumId, identitySecretHex);
}

export async function checkRegisteredAction(quorumId: string, identitySecretHex: string): Promise<boolean> {
  return isRegistered(quorumId, identitySecretHex);
}

export async function refreshQuorumAction(quorumId: string) {
  return getQuorumSnapshot(quorumId);
}

export async function submitClaimAction(
  quorumRouteId: string,
  recipientSecretHex: string
): Promise<ClaimAction> {
  return submitClaim(quorumRouteId, recipientSecretHex);
}

export async function disputeClaimAction(quorumRouteId: string, arbiterSecretHex: string): Promise<ClaimAction> {
  return disputeClaim(quorumRouteId, arbiterSecretHex);
}

export async function refreshClaimsAction() {
  return listClaimSnapshots();
}

export async function unclaimedQuorumsAction() {
  return listUnclaimedQuorumIds();
}

export async function devnetStatusAction(): Promise<DevnetStatus> {
  return checkLocalDevnet();
}
