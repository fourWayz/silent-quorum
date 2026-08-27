"use client";

import { useState } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { getOrCreateClaimSecret } from "@/lib/protocol/identity";
import { submitClaimAction } from "@/lib/protocol/actions";
import type { ClaimSnapshot } from "@/lib/protocol/types";
import { cn } from "@/lib/utils";

interface EligibleQuorum {
  id: string;
  name: string;
  fired: boolean;
}

export function ClaimRitual({
  eligible,
  onSubmitted
}: {
  eligible: EligibleQuorum[];
  onSubmitted: (snapshots: ClaimSnapshot[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(eligible[0]?.id ?? null);
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  if (eligible.length === 0) {
    return (
      <GlassPanel className="p-6 text-sm text-ink-300">
        Every quorum in this simulator already has a claim recorded. Redeploy the simulator (restart the dev
        server) to try the claim ritual again.
      </GlassPanel>
    );
  }

  async function handleSubmit() {
    if (!selected) return;
    setState("submitting");
    const secret = getOrCreateClaimSecret(selected);
    const result = await submitClaimAction(selected, secret);
    if (!result.ok) {
      setError(result.error);
      setState("error");
      return;
    }
    onSubmitted(result.snapshots);
    setState("done");
  }

  const chosen = eligible.find((q) => q.id === selected);

  return (
    <GlassPanel className="p-6">
      <p className="mb-4 text-sm leading-relaxed text-ink-200">
        Choose a quorum to submit a claim against. This proves you control a recipient secret you generate
        locally — it does not prove the quorum fired.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {eligible.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => {
              setSelected(q.id);
              setState("idle");
            }}
            className={cn(
              "rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors",
              selected === q.id
                ? "border-signal-400 bg-signal-950/60 text-signal-200"
                : "border-ink-600 text-ink-300 hover:border-ink-400"
            )}
          >
            {q.name}
          </button>
        ))}
      </div>

      {chosen ? (
        <div
          className={cn(
            "mb-5 flex items-start gap-2.5 rounded-lg border p-3 text-xs leading-relaxed",
            chosen.fired ? "border-signal-600/40 bg-signal-950/40 text-signal-200" : "border-ignition-600/40 bg-ignition-600/10 text-ignition-200"
          )}
        >
          {chosen.fired ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {chosen.fired
              ? "This quorum has already fired — an unremarkable claim."
              : "This quorum has NOT reached its threshold yet. The Claim Ledger has no way to check that and will accept the claim anyway — this is a documented trust boundary of the protocol, not a bug."}
          </span>
        </div>
      ) : null}

      {state === "error" ? <p className="mb-4 text-xs text-ignition-300">{error}</p> : null}
      {state === "done" ? (
        <p className="mb-4 text-xs text-signal-300">Claim submitted and recorded below.</p>
      ) : (
        <Button onClick={handleSubmit} disabled={state === "submitting" || !selected}>
          {state === "submitting" ? "Proving recipient secret…" : "Submit Claim"}
        </Button>
      )}
    </GlassPanel>
  );
}
