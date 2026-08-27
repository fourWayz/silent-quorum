import "server-only";
import {
  leafFor,
  issuerCommitmentFor,
  operatorCommitmentFor,
  arbiterCommitmentFor,
  recipientCommitmentFor,
  b32
} from "../../../../../contract/dist/domain.js";
import { SilentQuorumSimulator, type QuorumConfig } from "../../../../../contract/dist/quorum-core/simulator.js";
import { RegistrySimulator, addressFor } from "../../../../../contract/dist/quorum-registry/simulator.js";
import { ClaimLedgerSimulator } from "../../../../../contract/dist/consequence-claim-ledger/simulator.js";
import { getStore, type QuorumRecord } from "./store";

const secretFor = (label: string): Uint8Array => b32(label);

interface SeedDefinition {
  id: string;
  /** Short internal code used only to derive off-chain secret labels
   * (issuer/seed-participant/recipient). Kept separate from `id` (the
   * pretty route slug) because every derived label must fit in the
   * padEnd(32)-byte budget domain.ts uses for Bytes<32> — a descriptive
   * route id plus a prefix like "issuer:" or "recipient:" would overflow
   * it silently truncating nothing (padEnd doesn't truncate) and instead
   * breaking the WASM boundary's fixed-length assumption. */
  code: string;
  name: string;
  summary: string;
  orgLabel: string;
  quorumLabel: string;
  actionLabel: string;
  recipientLabel: string;
  threshold: number;
  amount: bigint;
  seededPledges: number; // how many synthetic participants pledge at seed time
  cancelled?: boolean;
}

const DEFINITIONS: SeedDefinition[] = [
  {
    id: "warehouse-safety-escalation",
    code: "wh-safety",
    name: "Warehouse Safety Escalation",
    summary:
      "Independent safety reports accumulate anonymously. No one — not even the issuer — learns who filed. The 12th pledge moves the case into binding arbitration in the same transaction.",
    orgLabel: "north-yard-collective",
    quorumLabel: "safety-escalation-q3",
    actionLabel: "trigger-arbitration",
    recipientLabel: "arbitration-escrow",
    threshold: 12,
    amount: 5_000n,
    seededPledges: 11 // one pledge from ignition — the interactive centerpiece
  },
  {
    id: "editorial-independence-fund",
    code: "editorial",
    name: "Editorial Independence Fund",
    summary:
      "Newsroom staff anonymously signal support for a protected story. Well under quorum — a field still accumulating, not yet near ignition.",
    orgLabel: "meridian-press",
    quorumLabel: "independence-fund-2026",
    actionLabel: "publish-protected-report",
    recipientLabel: "protected-publication-escrow",
    threshold: 40,
    amount: 15_000n,
    seededPledges: 9
  },
  {
    id: "harbor-strike-authorization",
    code: "harbor",
    name: "Harbor Freight Strike Authorization",
    summary:
      "Called off by the issuer before reaching quorum. Cancellation is one-way and, once a quorum has fired, purely symbolic — this one never fired, so cancellation stopped it outright.",
    orgLabel: "harborfreight-workers",
    quorumLabel: "strike-authorization-2026",
    actionLabel: "authorize-strike",
    recipientLabel: "strike-fund-trustee",
    threshold: 50,
    amount: 2_500n,
    seededPledges: 17,
    cancelled: true
  },
  {
    id: "riverside-relief-release",
    code: "riverside",
    name: "Riverside Mutual Aid Release",
    summary:
      "Already reached quorum. The 30th independent pledge fired the consequence atomically — the same transaction that counted it also released the recorded balance.",
    orgLabel: "riverside-mutual-aid",
    quorumLabel: "relief-trigger-2026",
    actionLabel: "release-relief-funds",
    recipientLabel: "relief-disbursement-escrow",
    threshold: 30,
    amount: 30_000n,
    seededPledges: 30
  }
];

function buildQuorum(def: SeedDefinition): QuorumRecord {
  const issuerSecret = secretFor(`iss:${def.code}`);
  const config: QuorumConfig = {
    org: b32(def.orgLabel),
    quorum: b32(def.quorumLabel),
    action: b32(def.actionLabel),
    threshold: BigInt(def.threshold),
    issuerCommitment: issuerCommitmentFor(issuerSecret),
    recipientCommitment: b32(def.recipientLabel),
    amount: def.amount
  };

  const bootstrapSecret = secretFor(`sd:${def.code}:0`);
  const sim = new SilentQuorumSimulator(config, bootstrapSecret, issuerSecret);

  for (let i = 0; i < def.seededPledges; i += 1) {
    const secret = secretFor(`sd:${def.code}:${i}`);
    sim.setIdentitySecret(secret);
    sim.register(leafFor(secret));
    sim.pledge();
  }

  if (def.cancelled) {
    sim.cancel();
  }

  return {
    id: def.id,
    code: def.code,
    name: def.name,
    summary: def.summary,
    orgLabel: def.orgLabel,
    quorumLabel: def.quorumLabel,
    actionLabel: def.actionLabel,
    consequenceRecipientLabel: def.recipientLabel,
    issuerSecret,
    sim,
    participantCount: def.seededPledges
  };
}

function buildRegistry(quorums: QuorumRecord[]) {
  const operatorSecret = secretFor("registry-operator");
  const operatorCommitment = operatorCommitmentFor(operatorSecret);
  const sim = new RegistrySimulator(operatorCommitment, operatorSecret);

  for (const q of quorums) {
    const ledger = q.sim.getLedger();
    sim.registerQuorum(ledger.quorum_id, addressFor(`core:${q.id}`), ledger.config_commitment);
  }
  // Demonstrate the one-way deactivate path on the cancelled quorum, for
  // narrative coherence (the Registry and Core are independently operated —
  // this correlation is a seed-data choice, not a protocol requirement).
  const cancelled = quorums.find((q) => q.sim.getLedger().cancelled);
  if (cancelled) {
    sim.deactivateQuorum(cancelled.sim.getLedger().quorum_id);
  }

  return { sim, operatorSecret };
}

function buildClaims(quorums: QuorumRecord[]) {
  const arbiterSecret = secretFor("claim-arbiter");
  const sim = new ClaimLedgerSimulator(arbiterCommitmentFor(arbiterSecret), secretFor("unused"), arbiterSecret);
  const recipientSecrets = new Map<string, Uint8Array>();

  // Claim #1 — against the already-fired Riverside quorum. A clean,
  // unremarkable claim: the recipient proves control of the secret behind
  // the commitment Core recorded as its consequence recipient.
  const fired = quorums.find((q) => q.id === "riverside-relief-release")!;
  const firedLedger = fired.sim.getLedger();
  const firedRecipientSecret = secretFor(`rcp:${fired.code}`);
  recipientSecrets.set("riverside-relief-release", firedRecipientSecret);
  sim.setRecipientSecret(firedRecipientSecret);
  sim.claim(
    firedLedger.org_id,
    firedLedger.quorum_id,
    firedLedger.action_id,
    recipientCommitmentFor(firedRecipientSecret),
    1n
  );

  // Claim #2 — deliberately references a quorum that has NOT fired
  // (Warehouse Safety Escalation, one pledge short of threshold at seed
  // time). The Claim Ledger has no way to know that and accepts it anyway
  // — this is the documented trust boundary from Milestone 2's audit,
  // demonstrated in the UI rather than hidden. The arbiter then disputes
  // it, which is the intended real-world remedy for exactly this case.
  const notFired = quorums.find((q) => q.id === "warehouse-safety-escalation")!;
  const notFiredLedger = notFired.sim.getLedger();
  const disputedRecipientSecret = secretFor(`rcp:${notFired.code}:d`);
  recipientSecrets.set("warehouse-safety-escalation", disputedRecipientSecret);
  sim.setRecipientSecret(disputedRecipientSecret);
  sim.claim(
    notFiredLedger.org_id,
    notFiredLedger.quorum_id,
    notFiredLedger.action_id,
    recipientCommitmentFor(disputedRecipientSecret),
    1n
  );
  sim.dispute(notFiredLedger.org_id, notFiredLedger.quorum_id, notFiredLedger.action_id);

  return { sim, arbiterSecret, recipientSecrets };
}

export function ensureSeeded() {
  const store = getStore();
  if (store.seeded) return;

  const quorums = DEFINITIONS.map(buildQuorum);
  for (const q of quorums) store.quorums.set(q.id, q);
  store.registry = buildRegistry(quorums);
  store.claims = buildClaims(quorums);
  store.seeded = true;
}

export const SEED_IDS = DEFINITIONS.map((d) => d.id);
