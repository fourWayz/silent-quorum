"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface Node {
  id: string;
  label: string;
  sub: string;
  description: string;
  x: number; // percentage
  y: number;
}

const NODES: Node[] = [
  {
    id: "participants",
    label: "Participants",
    sub: "private pledge",
    description:
      "Each participant proves membership with a Merkle path and a domain-separated nullifier. Only the proof and the nullifier ever leave their device — never the identity secret or which leaf is theirs.",
    x: 50,
    y: 10
  },
  {
    id: "core",
    label: "Quorum Core",
    sub: "eligibility · nullifiers · tally · threshold",
    description:
      "The protocol's cryptographic heart. Registration, pledging, the threshold check, and firing the consequence all happen in one circuit, one proof, one transaction — verified atomic on live devnet, not just asserted.",
    x: 50,
    y: 46
  },
  {
    id: "registry",
    label: "Registry",
    sub: "discovery layer",
    description:
      "A curated directory of deployed Core instances. It records what a trusted operator claims — it cannot read Core's real state, because Compact 0.31.1 has no cross-contract reads.",
    x: 25,
    y: 82
  },
  {
    id: "claims",
    label: "Claim Ledger",
    sub: "recipient layer",
    description:
      "Proves a claimant controls a recipient secret. It cannot verify the referenced quorum actually fired — the same toolchain limitation applies here, and this UI never implies otherwise.",
    x: 75,
    y: 82
  }
];

export function ArchitectureDiagram() {
  const [active, setActive] = useState<string>("core");
  const activeNode = NODES.find((n) => n.id === active)!;

  return (
    <div>
      <div className="relative mx-auto aspect-[4/3.4] w-full max-w-2xl px-4 py-6 sm:px-8">
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <line x1="50%" y1="19%" x2="50%" y2="39%" stroke="var(--ink-500)" strokeWidth={1} />
          <line x1="50%" y1="55%" x2="29%" y2="76%" stroke="var(--ink-500)" strokeWidth={1} />
          <line x1="50%" y1="55%" x2="71%" y2="76%" stroke="var(--ink-500)" strokeWidth={1} />
        </svg>

        {NODES.map((node) => {
          const isActive = node.id === active;
          const isCore = node.id === "core";
          return (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => setActive(node.id)}
              onFocus={() => setActive(node.id)}
              onClick={() => setActive(node.id)}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2.5 text-center transition-all duration-200 sm:px-4 sm:py-3",
                isCore ? "w-36 sm:w-52" : "w-28 sm:w-40",
                isActive
                  ? "border-signal-400 bg-signal-950/70 shadow-[0_0_24px_-6px_rgba(52,202,164,0.6)]"
                  : "border-ink-600 bg-ink-900/70 hover:border-ink-400"
              )}
            >
              <span className={cn("block font-display text-xs sm:text-sm", isActive ? "text-signal-200" : "text-paper")}>
                {node.label}
              </span>
              <span className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.06em] text-ink-400 sm:block">
                {node.sub}
              </span>
              {isCore ? (
                <span className="mt-1.5 block font-mono text-[8px] uppercase tracking-[0.1em] text-ignition-300">
                  atomic boundary
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeNode.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto mt-8 max-w-xl rounded-lg border border-ink-600 bg-ink-900/50 p-5 text-center"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal-400">{activeNode.label}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-200">{activeNode.description}</p>
      </motion.div>
    </div>
  );
}
