import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { EnvironmentBadge } from "@/components/environment/environment-badge";
import { ClaimsBoard } from "@/components/claims/claims-board";
import { listClaimSnapshots, listUnclaimedQuorumIds } from "@/lib/protocol/engine/claims";
import { listQuorumSnapshots } from "@/lib/protocol/engine/quorum";

export const metadata: Metadata = { title: "Claim Ledger" };
export const dynamic = "force-dynamic";

export default function ClaimsPage() {
  const claims = listClaimSnapshots();
  const unclaimedIds = new Set(listUnclaimedQuorumIds());
  const quorums = listQuorumSnapshots();
  const eligible = quorums
    .filter((q) => unclaimedIds.has(q.id))
    .map((q) => ({ id: q.id, name: q.name, fired: q.fired }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          eyebrow="Recipient layer"
          title="Consequence Claim Ledger"
          description="Proves exactly one thing: the claimant knows the secret behind the recipient commitment they supplied. It does not — and structurally cannot — verify that the referenced quorum ever fired."
        />
        <div className="flex flex-col items-end gap-2">
          <EnvironmentBadge kind="simulator" />
          <Link href="/live" className="font-mono text-[11px] text-ink-400 hover:text-signal-300">
            View the real Preprod deployment →
          </Link>
        </div>
      </div>

      <ClaimsBoard initialClaims={claims} eligible={eligible} />
    </div>
  );
}
