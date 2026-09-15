import type { Metadata } from "next";
import Link from "next/link";
import { GlassPanel } from "@/components/ui/glass-panel";
import { RegistryStatusPill } from "@/components/ui/status-pill";
import { CopyableHash } from "@/components/ui/copyable-hash";
import { EnvironmentBadge } from "@/components/environment/environment-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { listRegistryEntries } from "@/lib/protocol/engine/registry";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Registry" };
export const dynamic = "force-dynamic";

export default function RegistryPage() {
  const entries = listRegistryEntries();

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          eyebrow="Discovery layer"
          title="Quorum Registry"
          description="A single curated operator records which Quorum Core instances exist. This is a directory, not a verification layer — the Registry cannot read Core's actual on-chain state (Compact 0.31.1 has no cross-contract reads)."
        />
        <div className="flex flex-col items-end gap-2">
          <EnvironmentBadge kind="simulator" />
          <Link href="/live" className="font-mono text-[11px] text-ink-400 hover:text-signal-300">
            View the real Preprod deployment →
          </Link>
        </div>
      </div>

      <div className="mb-10 rounded-lg border border-ink-600 bg-ink-900/40 p-4 text-sm leading-relaxed text-ink-300">
        <strong className="text-paper">Registered</strong> means the operator claims this configuration commitment
        for this Core address — not that it was independently verified. The commitment shown alongside each
        entry is read directly from the linked Core instance here, for client-side comparison only, since the
        Registry itself has no way to read Core&rsquo;s state.
      </div>

      <div className="flex flex-col gap-3">
        {entries.map((entry) => {
          const matches = entry.coreConfigCommitment === entry.configCommitment;
          return (
            <GlassPanel key={entry.quorumId} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
                    {entry.coreAddressLabel}
                  </p>
                  <h3 className="mt-1 font-display text-lg text-paper">{entry.quorumLabel}</h3>
                </div>
                <RegistryStatusPill status={entry.status} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    Operator-claimed config commitment
                  </p>
                  <CopyableHash value={entry.configCommitment} label="registry config commitment" />
                </div>
                <div>
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    Core&rsquo;s actual config commitment
                  </p>
                  {entry.coreConfigCommitment ? (
                    <CopyableHash value={entry.coreConfigCommitment} label="core config commitment" />
                  ) : (
                    <span className="text-xs text-ink-400">Core instance not resolvable client-side</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    matches ? "text-signal-300" : "text-ignition-300"
                  )}
                >
                  {matches ? "✓ Matches — verified by this client, not by the protocol" : "⚠ Mismatch"}
                </span>
                {entry.linkedQuorumRouteId ? (
                  <Link href={`/console/${entry.linkedQuorumRouteId}`} className="font-mono text-[11px] text-ink-300 hover:text-signal-300">
                    View Core instance →
                  </Link>
                ) : null}
              </div>
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
}
