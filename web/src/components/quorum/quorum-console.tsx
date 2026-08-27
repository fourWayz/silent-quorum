"use client";

import { useState } from "react";
import { ThresholdField } from "./threshold-field";
import { PledgeRitual } from "./pledge-ritual";
import { IgnitionOverlay } from "./ignition-overlay";
import { StateMachineDiagram } from "./state-machine-diagram";
import { QuorumStatusPill } from "@/components/ui/status-pill";
import { primaryStatus, type QuorumSnapshot } from "@/lib/protocol/types";

export function QuorumConsole({ initial }: { initial: QuorumSnapshot }) {
  const [quorum, setQuorum] = useState(initial);
  const [igniting, setIgniting] = useState(false);
  const status = primaryStatus(quorum);

  return (
    <>
      <IgnitionOverlay visible={igniting} onDone={() => setIgniting(false)} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex justify-center">
          <ThresholdField tally={quorum.tally} threshold={quorum.threshold} status={status} />
        </div>

        <div>
          <div className="mb-5 flex items-center gap-3">
            <QuorumStatusPill status={status} />
            <span className="font-mono text-xs text-ink-400">
              {quorum.tally}/{quorum.threshold} pledged
            </span>
          </div>
          <StateMachineDiagram flags={quorum} />

          <div className="mt-8 border-t border-white/[0.06] pt-8">
            <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">Your Pledge</h3>
            <PledgeRitual quorum={quorum} onQuorumUpdate={setQuorum} onFired={() => setIgniting(true)} />
          </div>
        </div>
      </div>
    </>
  );
}
