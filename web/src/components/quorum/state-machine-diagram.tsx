import { cn } from "@/lib/utils";
import type { QuorumFlags } from "@/lib/protocol/types";

function Node({ label, active, tone = "signal" }: { label: string; active: boolean; tone?: "signal" | "ignition" | "mute" }) {
  const toneClasses = {
    signal: "border-signal-400 text-signal-200 bg-signal-950/60 shadow-[0_0_16px_-2px_rgba(52,202,164,0.5)]",
    ignition: "border-ignition-400 text-ignition-200 bg-ignition-600/10 shadow-[0_0_16px_-2px_rgba(242,165,61,0.55)]",
    mute: "border-mute-500 text-mute-300 bg-ink-800/60"
  } as const;
  return (
    <span
      className={cn(
        "rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-all duration-300",
        active ? toneClasses[tone] : "border-ink-600 text-ink-400"
      )}
    >
      {label}
    </span>
  );
}

function Arrow() {
  return <span className="text-ink-500">→</span>;
}

/** Two independent tracks, deliberately not collapsed into one linear
 * state machine — registration and firing are independent flags on-chain
 * (see ARCHITECTURE.md / types.ts's comment on QuorumFlags). Forcing them
 * into a single line would misrepresent states the real contract can
 * actually be in, e.g. registration still open after firing. */
export function StateMachineDiagram({ flags }: { flags: QuorumFlags }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Registration</p>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="Open" active={flags.registrationOpen} />
          <Arrow />
          <Node label="Closed" active={!flags.registrationOpen} tone="mute" />
        </div>
      </div>
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Consequence</p>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="Active" active={!flags.fired && !flags.cancelled} />
          <Arrow />
          <Node label="Fired" active={flags.fired} tone="ignition" />
          <span className="mx-1 text-ink-600">/</span>
          <Node label="Cancelled" active={flags.cancelled} tone="mute" />
        </div>
      </div>
    </div>
  );
}
