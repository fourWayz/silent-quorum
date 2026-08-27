import "server-only";
import { bytesToHex } from "@/lib/utils";
import { ensureSeeded } from "./seed";
import { getStore } from "./store";
import type { RegistryEntry } from "../types";

export function listRegistryEntries(): RegistryEntry[] {
  ensureSeeded();
  const store = getStore();
  if (!store.registry) return [];
  const entries: RegistryEntry[] = [];
  for (const [quorumId, record] of store.registry.sim.getLedger().quorums) {
    // Find the matching Core instance purely by comparing quorumId bytes —
    // a client-side convenience for this demo, not something the Registry
    // contract itself does or could do.
    const linked = [...store.quorums.values()].find(
      (q) => bytesToHex(q.sim.getLedger().quorum_id) === bytesToHex(quorumId)
    );
    entries.push({
      quorumId: bytesToHex(quorumId),
      quorumLabel: linked?.quorumLabel ?? "(unlabeled)",
      linkedQuorumRouteId: linked?.id ?? null,
      coreAddressLabel: linked ? `core:${linked.id}` : "unknown",
      configCommitment: bytesToHex(record.configCommitment),
      coreConfigCommitment: linked ? bytesToHex(linked.sim.getLedger().config_commitment) : null,
      status: record.status === 0 ? "active" : "deactivated"
    });
  }
  return entries;
}
