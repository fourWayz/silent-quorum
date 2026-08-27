import Link from "next/link";
import { GlassPanel } from "@/components/ui/glass-panel";
import { QuorumStatusPill } from "@/components/ui/status-pill";
import { primaryStatus, type QuorumSnapshot } from "@/lib/protocol/types";
import { cn } from "@/lib/utils";

export function QuorumCard({ quorum }: { quorum: QuorumSnapshot }) {
  const status = primaryStatus(quorum);
  const pct = Math.min(100, Math.round((quorum.tally / quorum.threshold) * 100));

  return (
    <Link href={`/console/${quorum.id}`} className="group block">
      <GlassPanel className="p-6 transition-colors duration-200 group-hover:border-signal-500/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">{quorum.orgLabel}</p>
            <h3 className="mt-1.5 font-display text-xl text-paper">{quorum.name}</h3>
          </div>
          <QuorumStatusPill status={status} />
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-ink-200">{quorum.summary}</p>

        <div className="mt-6">
          <div className="flex items-baseline justify-between font-mono text-xs text-ink-300">
            <span>
              <span className="font-mono-tabular text-paper">{quorum.tally}</span> / {quorum.threshold} pledged
            </span>
            <span className="font-mono-tabular">{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]",
                status === "fired" && "bg-ignition-400",
                status === "cancelled" && "bg-mute-500",
                status === "active" && "bg-signal-400"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </GlassPanel>
    </Link>
  );
}
