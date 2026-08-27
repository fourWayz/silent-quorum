import { Badge } from "./badge";
import type { QuorumPrimaryStatus, RegistryStatus, ClaimStatus } from "@/lib/protocol/types";

export function QuorumStatusPill({ status }: { status: QuorumPrimaryStatus }) {
  if (status === "fired") return <Badge tone="ignition">Fired</Badge>;
  if (status === "cancelled") return <Badge tone="mute">Cancelled</Badge>;
  return <Badge tone="signal">Active</Badge>;
}

export function RegistryStatusPill({ status }: { status: RegistryStatus }) {
  return status === "active" ? <Badge tone="signal">Active</Badge> : <Badge tone="mute">Deactivated</Badge>;
}

export function ClaimStatusPill({ status }: { status: ClaimStatus }) {
  return status === "claimed" ? <Badge tone="signal">Claimed</Badge> : <Badge tone="ignition">Disputed</Badge>;
}
