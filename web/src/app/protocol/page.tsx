import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { ArchitectureDiagram } from "@/components/architecture/architecture-diagram";
import { PROTOCOL_STEPS, ENFORCEMENT_TABLE, PRIOR_ART } from "@/lib/protocol/content";

export const metadata: Metadata = { title: "Protocol" };

export default function ProtocolPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
      <SectionHeading
        eyebrow="How it works"
        title="An atomic threshold-ignition protocol"
        description="Silent Quorum lets a group act collectively without anyone needing to know who else is participating — until, and only until, enough of them have."
      />

      <ol className="mt-16 flex flex-col gap-10">
        {PROTOCOL_STEPS.map((step, i) => (
          <li key={step.index} className="relative flex gap-6 pl-2">
            <div className="flex flex-col items-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-signal-600/50 bg-signal-950/50 font-mono text-sm text-signal-300">
                {step.index}
              </span>
              {i < PROTOCOL_STEPS.length - 1 ? <span className="mt-2 w-px flex-1 bg-ink-600" /> : null}
            </div>
            <div className="pb-2">
              <h3 className="font-display text-xl text-paper">{step.title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-200">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-20 border-t border-white/[0.06] pt-16">
        <SectionHeading eyebrow="Architecture" title="Three contracts, one atomic boundary" align="center" className="mx-auto" />
        <div className="mt-10">
          <ArchitectureDiagram />
        </div>
      </div>

      <div className="mt-20 border-t border-white/[0.06] pt-16">
        <SectionHeading eyebrow="What's real" title="Cryptographically enforced vs. client-verified" />
        <div className="mt-8 overflow-x-auto rounded-lg border border-ink-600">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-600 bg-ink-900/60 text-left">
                <th className="p-4 font-mono text-[11px] uppercase tracking-[0.1em] text-signal-300">
                  Enforced on-chain, by a circuit
                </th>
                <th className="p-4 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-400">
                  Verified off-chain, by whoever uses the protocol
                </th>
              </tr>
            </thead>
            <tbody>
              {ENFORCEMENT_TABLE.map((row) => (
                <tr key={row.enforced} className="border-b border-ink-700 last:border-0">
                  <td className="p-4 align-top text-paper">{row.enforced}</td>
                  <td className="p-4 align-top text-ink-300">{row.clientVerified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-20 border-t border-white/[0.06] pt-16">
        <SectionHeading eyebrow="Prior art" title="A composition, not a new primitive" />
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PRIOR_ART.map((item) => (
            <div key={item.name} className="rounded-lg border border-ink-600 bg-ink-900/40 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.1em] text-signal-400">{item.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-20 flex justify-center border-t border-white/[0.06] pt-16">
        <Link href="/console" className={buttonVariants({ variant: "primary", size: "lg" })}>
          See it run in the Console
        </Link>
      </div>
    </div>
  );
}
