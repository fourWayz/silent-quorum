import "server-only";

// Silent Quorum — real, read-only Preprod integration.
//
// This is the ONLY module that talks to the live Midnight Preprod
// network. It reads each deployed contract's actual on-chain ledger via
// the indexer's queryContractState, then decodes it with the exact same
// compiled ledger() function the simulator uses — the same decode path,
// fed real fetched state instead of local simulator state. Nothing here
// is simulated, fabricated, or backfilled from the simulator store.
//
// Writes are deliberately NOT implemented here. Submitting a real
// transaction needs a synced wallet, and the wallet sync this project's
// own deployment tooling depends on took 3-5 hours *per fresh process*
// against Preprod (see PREPROD_DEPLOYMENT.md) — fundamentally
// incompatible with a web request/response cycle. A long-lived warm
// singleton wallet is theoretically possible but was judged not worth
// the credential-handling risk and multi-hour cold-start fragility for
// this milestone. Read-only is the honest, safely supportable scope.

import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/platform-js/effect/ContractAddress";

import { ledger as coreLedgerOf } from "../../../../../contract/dist/quorum-core/managed/contract/index.js";
import { ledger as registryLedgerOf } from "../../../../../contract/dist/quorum-registry/managed/contract/index.js";
import { ledger as claimLedgerOf } from "../../../../../contract/dist/consequence-claim-ledger/managed/contract/index.js";
import { claimIdFor } from "../../../../../contract/dist/domain.js";

import { bytesToHex, decodeLabel, errorMessage } from "@/lib/utils";
import { PREPROD_CONFIG } from "../preprod-config";
import type { QuorumSnapshot, RegistryEntry, ClaimSnapshot } from "../types";

export type PreprodRead<T> = { ok: true; data: T } | { ok: false; error: string };

let cachedProvider: ReturnType<typeof indexerPublicDataProvider> | null = null;
function provider() {
  if (!cachedProvider) {
    cachedProvider = indexerPublicDataProvider(PREPROD_CONFIG.indexerUrl, PREPROD_CONFIG.indexerWsUrl);
  }
  return cachedProvider;
}

// queryContractState's real return type comes from compact-runtime's
// ContractState class: it has a `.data: ChargedState` field, which is
// exactly what each compiled contract's own exported `ledger()` function
// accepts — the same decode path the simulator uses, fed real fetched
// state instead of local state. The indexer-provider package's own public
// types don't line up precisely enough with the compiled contract's
// generated types to express this bridge without a cast; this one is
// deliberate and narrow, not a general escape hatch, matching the same
// `as any` bridging pattern devnet-test's own scripts already use at this
// exact SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLedger<L>(address: string, decode: (state: any) => L): Promise<L | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contractState = (await provider().queryContractState(ContractAddress(address) as any)) as {
    data: unknown;
  } | null;
  if (!contractState) return null;
  return decode(contractState.data);
}

const PREPROD_QUORUM_ROUTE_ID = "preprod-flagship";

function coreToSnapshot(l: ReturnType<typeof coreLedgerOf>): QuorumSnapshot {
  const orgLabel = decodeLabel(l.org_id);
  const quorumLabel = decodeLabel(l.quorum_id);
  const actionLabel = decodeLabel(l.action_id);
  return {
    id: PREPROD_QUORUM_ROUTE_ID,
    name: "Silent Quorum — Preprod Flagship",
    summary:
      "The real, deployed Quorum Core instance on Midnight Preprod. Every value below is read live from the indexer, decoded with the same compiled circuit output used everywhere else in this project — not simulator data.",
    orgId: bytesToHex(l.org_id),
    quorumId: bytesToHex(l.quorum_id),
    actionId: bytesToHex(l.action_id),
    orgLabel,
    quorumLabel,
    actionLabel,
    threshold: Number(l.threshold),
    tally: Number(l.tally),
    consequenceAmount: l.consequence_amount.toString(),
    consequenceRecipientLabel: decodeLabel(l.consequence_recipient_commitment),
    consequenceRecipientCommitment: bytesToHex(l.consequence_recipient_commitment),
    issuerCommitment: bytesToHex(l.issuer_commitment),
    configCommitment: bytesToHex(l.config_commitment),
    protocolVersion: Number(l.protocol_version),
    fired: l.fired,
    cancelled: l.cancelled,
    registrationOpen: l.registration_open,
    // eligibility_tree exposes no direct participant-count accessor; tally
    // is a real on-chain lower bound (every pledge implies a prior
    // registration) — not a fabricated number, just an honest proxy.
    participantCount: Number(l.tally)
  };
}

export async function getPreprodCore(): Promise<PreprodRead<QuorumSnapshot>> {
  try {
    const l = await fetchLedger(PREPROD_CONFIG.coreAddress, coreLedgerOf);
    if (!l) return { ok: false, error: "Core contract state not found at the configured address." };
    return { ok: true, data: coreToSnapshot(l) };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Failed to read Core state from the Preprod indexer.") };
  }
}

export async function getPreprodRegistry(): Promise<PreprodRead<RegistryEntry[]>> {
  try {
    const [registryLedger, core] = await Promise.all([
      fetchLedger(PREPROD_CONFIG.registryAddress, registryLedgerOf),
      getPreprodCore()
    ]);
    if (!registryLedger) return { ok: false, error: "Registry contract state not found at the configured address." };

    const entries: RegistryEntry[] = [];
    for (const [quorumId, record] of registryLedger.quorums) {
      const linked = core.ok && bytesToHex(quorumId) === core.data.quorumId ? core.data : null;
      entries.push({
        quorumId: bytesToHex(quorumId),
        quorumLabel: linked?.quorumLabel ?? decodeLabel(quorumId),
        linkedQuorumRouteId: linked ? PREPROD_QUORUM_ROUTE_ID : null,
        coreAddressLabel: PREPROD_CONFIG.coreAddress,
        configCommitment: bytesToHex(record.configCommitment),
        coreConfigCommitment: linked ? linked.configCommitment : null,
        status: record.status === 0 ? "active" : "deactivated"
      });
    }
    return { ok: true, data: entries };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Failed to read Registry state from the Preprod indexer.") };
  }
}

export async function getPreprodClaims(): Promise<PreprodRead<ClaimSnapshot[]>> {
  try {
    const [claimLedger, core] = await Promise.all([
      fetchLedger(PREPROD_CONFIG.claimAddress, claimLedgerOf),
      getPreprodCore()
    ]);
    if (!claimLedger) return { ok: false, error: "Claim Ledger contract state not found at the configured address." };
    if (!core.ok) return { ok: false, error: core.error };

    const snapshots: ClaimSnapshot[] = [];
    const orgBytes = Buffer.from(core.data.orgId, "hex");
    const quorumBytes = Buffer.from(core.data.quorumId, "hex");
    const actionBytes = Buffer.from(core.data.actionId, "hex");
    const claimId = claimIdFor(orgBytes, quorumBytes, actionBytes);
    if (claimLedger.claims.member(claimId)) {
      const record = claimLedger.claims.lookup(claimId);
      snapshots.push({
        claimId: bytesToHex(claimId),
        orgLabel: core.data.orgLabel,
        quorumLabel: core.data.quorumLabel,
        actionLabel: core.data.actionLabel,
        linkedQuorumRouteId: PREPROD_QUORUM_ROUTE_ID,
        recipientCommitment: bytesToHex(record.recipientCommitment),
        consequenceType: Number(record.consequenceType),
        status: record.status === 0 ? "claimed" : "disputed"
      });
    }
    return { ok: true, data: snapshots };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Failed to read Claim Ledger state from the Preprod indexer.") };
  }
}

export interface PreprodHealth {
  network: string;
  reachable: boolean;
  blockHeight: number | null;
  core: "reachable" | "unreachable";
  registry: "reachable" | "unreachable";
  claimLedger: "reachable" | "unreachable";
  checkedAt: string;
}

/** A genuine readiness probe — queries the real indexer for current block
 * height and each contract's presence. Never fabricates "healthy" when a
 * query fails; reports exactly what was reachable. */
export async function getPreprodHealth(): Promise<PreprodHealth> {
  const checkedAt = new Date().toISOString();
  let blockHeight: number | null = null;
  try {
    const res = await fetch(PREPROD_CONFIG.indexerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ block { height } }" }),
      signal: AbortSignal.timeout(4000),
      cache: "no-store"
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: { block?: { height?: unknown } } };
      const h = json?.data?.block?.height;
      if (typeof h === "number") blockHeight = h;
    }
  } catch {
    // reachable stays false via blockHeight === null below
  }

  const [core, registry, claims] = await Promise.all([getPreprodCore(), getPreprodRegistry(), getPreprodClaims()]);

  return {
    network: PREPROD_CONFIG.network,
    reachable: blockHeight !== null,
    blockHeight,
    core: core.ok ? "reachable" : "unreachable",
    registry: registry.ok ? "reachable" : "unreachable",
    claimLedger: claims.ok ? "reachable" : "unreachable",
    checkedAt
  };
}
