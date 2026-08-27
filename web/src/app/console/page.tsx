import type { Metadata } from "next";
import { QuorumCard } from "@/components/quorum/quorum-card";
import { EnvironmentBadge } from "@/components/environment/environment-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { listQuorumSnapshots } from "@/lib/protocol/engine/quorum";

export const metadata: Metadata = { title: "Quorums" };
export const dynamic = "force-dynamic";

export default function ConsolePage() {
  const quorums = listQuorumSnapshots();

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          eyebrow="Quorum Console"
          title="Active quorums"
          description="Each card below is a real, independently deployed Quorum Core instance in the simulator — the same compiled circuits audited in Milestone 2."
        />
        <EnvironmentBadge kind="simulator" />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {quorums.map((q) => (
          <QuorumCard key={q.id} quorum={q} />
        ))}
      </div>
    </div>
  );
}
