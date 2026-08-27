import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/hero/hero";
import { MechanismStrip } from "@/components/protocol/mechanism-strip";
import { SectionHeading } from "@/components/ui/section-heading";
import { QuorumCard } from "@/components/quorum/quorum-card";
import { buttonVariants } from "@/components/ui/button";
import { listQuorumSnapshots } from "@/lib/protocol/engine/quorum";
import { sortQuorumsForShowcase } from "@/lib/protocol/types";

export const dynamic = "force-dynamic";

export default function Home() {
  const quorums = sortQuorumsForShowcase(listQuorumSnapshots()).slice(0, 3);

  return (
    <>
      <Hero />

      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <SectionHeading
          eyebrow="Why privacy matters here"
          title="Collective action fails when participation itself is a liability."
          description="If joining a safety escalation, a wage action, or a protected disclosure exposes who you are before the group has enough people to matter, most people never join. Silent Quorum hides identity at the moment it is most dangerous to reveal — while still letting everyone see, honestly, how close the group is to acting."
        />
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <SectionHeading eyebrow="The mechanism" title="Six steps, one atomic boundary." className="mb-10" />
        <MechanismStrip />
        <div className="mt-8 flex justify-center">
          <Link href="/protocol" className={buttonVariants({ variant: "ghost", className: "group" })}>
            Walk through the full protocol
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Live in the simulator" title="Active quorums" />
          <Link href="/console" className={buttonVariants({ variant: "outline", size: "sm" })}>
            View all quorums
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {quorums.map((q) => (
            <QuorumCard key={q.id} quorum={q} />
          ))}
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-ink-900/40 py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-5 text-center sm:px-8">
          <h2 className="font-display text-3xl text-paper sm:text-4xl">
            Enter the console. Pledge without a name.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-200">
            Every pledge in the console runs the real, independently audited compiled Compact circuits — not a
            mockup.
          </p>
          <Link href="/console" className={buttonVariants({ variant: "primary", size: "lg", className: "mt-8" })}>
            Enter the Console
          </Link>
        </div>
      </section>
    </>
  );
}
