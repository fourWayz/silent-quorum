import { PROTOCOL_STEPS } from "@/lib/protocol/content";

export function MechanismStrip() {
  return (
    <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-6">
      {PROTOCOL_STEPS.map((step) => (
        <li key={step.index} className="bg-ink-950 p-6">
          <span className="font-mono text-xs text-signal-400">{step.index}</span>
          <h3 className="mt-3 font-display text-lg text-paper">{step.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-300">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
