import Link from "next/link";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ClaimStatusPill } from "@/components/ui/status-pill";
import { CopyableHash } from "@/components/ui/copyable-hash";
import type { ClaimSnapshot } from "@/lib/protocol/types";

export function ClaimCard({ claim }: { claim: ClaimSnapshot }) {
  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">{claim.orgLabel}</p>
          <h3 className="mt-1 font-display text-lg text-paper">{claim.quorumLabel}</h3>
          <p className="mt-1 text-xs text-ink-400">{claim.actionLabel}</p>
        </div>
        <ClaimStatusPill status={claim.status} />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Claim ID</p>
        <CopyableHash value={claim.claimId} label="claim id" />
      </div>

      {claim.linkedQuorumRouteId ? (
        <Link
          href={`/console/${claim.linkedQuorumRouteId}`}
          className="mt-4 inline-block font-mono text-[11px] text-ink-300 hover:text-signal-300"
        >
          View referenced quorum →
        </Link>
      ) : null}
    </GlassPanel>
  );
}
