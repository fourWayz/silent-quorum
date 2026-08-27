import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QuorumField } from "./quorum-field";
import { buttonVariants } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden border-b border-white/[0.06]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 38%, rgba(27,156,128,0.16), transparent 70%), radial-gradient(90% 60% at 50% 100%, rgba(6,7,8,0.9), transparent)"
        }}
      />
      <QuorumField />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-5 text-center sm:px-8">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-signal-300">
          Atomic threshold-ignition protocol · Midnight
        </p>
        <h1 className="font-display text-[2.75rem] leading-[1.02] text-paper sm:text-6xl md:text-7xl">
          Private signals.
          <br />
          Public consequence.
        </h1>
        <p className="mt-7 max-w-xl text-balance text-base leading-relaxed text-ink-200 sm:text-lg">
          Participants prove eligibility without exposing their identity. Each valid pledge advances the quorum.
          When the threshold is reached, the consequence fires — in the same transaction.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/console" className={buttonVariants({ variant: "primary", size: "lg", className: "group" })}>
            Enter the Console
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
          <Link href="/protocol" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Read the Protocol
          </Link>
        </div>

        <p className="mt-14 max-w-sm text-xs leading-relaxed text-ink-400">
          Above: an illustrative visualization of pledge accumulation and threshold ignition — not live chain data.
          See the real thing in the Console.
        </p>
      </div>
    </section>
  );
}
