import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EnvironmentBadge } from "@/components/environment/environment-badge";
import { MetadataPanel } from "@/components/quorum/metadata-panel";
import { QuorumConsole } from "@/components/quorum/quorum-console";
import { getQuorumSnapshot } from "@/lib/protocol/engine/quorum";

// This app holds live, mutable protocol state in an in-memory simulator
// (see lib/protocol/engine/store.ts) — every request must read the
// current state, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function QuorumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quorum = getQuorumSnapshot(id);
  if (!quorum) notFound();

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <Link href="/console" className="mb-8 inline-flex items-center gap-1.5 font-mono text-xs text-ink-300 hover:text-signal-300">
        <ArrowLeft className="h-3.5 w-3.5" /> All quorums
      </Link>

      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-400">{quorum.orgLabel}</p>
          <h1 className="mt-1.5 font-display text-4xl text-paper">{quorum.name}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-200">{quorum.summary}</p>
        </div>
        <EnvironmentBadge kind="simulator" />
      </div>

      <QuorumConsole initial={quorum} />

      <div className="mt-16 border-t border-white/[0.06] pt-10">
        <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">Configuration</h2>
        <MetadataPanel quorum={quorum} />
      </div>
    </div>
  );
}
