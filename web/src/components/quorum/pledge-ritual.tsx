"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Lock, ShieldCheck, Fingerprint, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrCreateIdentitySecret } from "@/lib/protocol/identity";
import { checkRegisteredAction, pledgeAction, registerAction } from "@/lib/protocol/actions";
import type { QuorumSnapshot } from "@/lib/protocol/types";
import { cn } from "@/lib/utils";

const RITUAL_STEPS = [
  { icon: ShieldCheck, label: "Verify Credential" },
  { icon: Fingerprint, label: "Generate Private Signal" },
  { icon: Lock, label: "Prove Membership" },
  { icon: Radio, label: "Issue Nullifier" },
  { icon: Check, label: "Advance Quorum" }
] as const;

type RitualState =
  | { kind: "checking" }
  | { kind: "unregistered" }
  | { kind: "registering" }
  | { kind: "ready" }
  | { kind: "pledging"; step: number }
  | { kind: "pledged" }
  | { kind: "already-pledged" }
  | { kind: "error"; message: string };

export function PledgeRitual({
  quorum,
  onQuorumUpdate,
  onFired
}: {
  quorum: QuorumSnapshot;
  onQuorumUpdate: (next: QuorumSnapshot) => void;
  onFired: () => void;
}) {
  const [state, setState] = useState<RitualState>({ kind: "checking" });
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    // Mount-time initialization from browser-only sources (localStorage)
    // and a server action — cannot be computed during render.
    const s = getOrCreateIdentitySecret(quorum.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecret(s);
    const pledgedKey = `silent-quorum:pledged:${quorum.id}`;
    if (window.localStorage.getItem(pledgedKey)) {
      setState({ kind: "already-pledged" });
      return;
    }
    checkRegisteredAction(quorum.id, s).then((registered) => {
      setState(registered ? { kind: "ready" } : { kind: "unregistered" });
    });
  }, [quorum.id]);

  async function handleRegister() {
    if (!secret) return;
    setState({ kind: "registering" });
    const result = await registerAction(quorum.id, secret);
    if (!result.ok) {
      setState({ kind: "error", message: result.error });
      return;
    }
    onQuorumUpdate(result.snapshot);
    setState({ kind: "ready" });
  }

  async function handlePledge() {
    if (!secret) return;
    // The real circuit call starts immediately, in parallel with the
    // step animation below — the animation only fills whatever time the
    // real call takes, it never adds delay on top of it. Steps 2–5 are
    // one real proof, one real transaction, not four separate ones; see
    // the caption below.
    const pledgePromise = pledgeAction(quorum.id, secret);

    const animateSteps = async () => {
      for (let i = 1; i < RITUAL_STEPS.length; i += 1) {
        setState({ kind: "pledging", step: i });
        await new Promise((r) => setTimeout(r, 220));
      }
    };
    const [result] = await Promise.all([pledgePromise, animateSteps()]);

    if (!result.ok) {
      setState({ kind: "error", message: result.error });
      return;
    }
    window.localStorage.setItem(`silent-quorum:pledged:${quorum.id}`, "1");
    onQuorumUpdate(result.snapshot);
    setState({ kind: "pledged" });
    if (result.justFired) onFired();
  }

  if (state.kind === "checking") {
    return <div className="h-12 animate-pulse rounded-lg bg-ink-800" />;
  }

  if (quorum.cancelled) {
    return (
      <div className="rounded-lg border border-mute-500/40 bg-ink-900/60 p-4 text-sm text-mute-300">
        This quorum was cancelled by its issuer. Pledging is closed.
      </div>
    );
  }

  if (state.kind === "already-pledged" || state.kind === "pledged") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-signal-600/40 bg-signal-950/50 p-4 text-sm text-signal-200">
        <Check className="h-4 w-4 shrink-0" />
        Your pledge is recorded. The nullifier prevents a second pledge from this identity in this quorum.
      </div>
    );
  }

  if (state.kind === "unregistered") {
    if (!quorum.registrationOpen) {
      return (
        <div className="rounded-lg border border-ink-600 bg-ink-900/60 p-4 text-sm text-ink-300">
          Registration is closed for new participants. Already-registered participants can still pledge.
        </div>
      );
    }
    return (
      <div>
        <p className="mb-3 text-sm leading-relaxed text-ink-200">
          In a real deployment, an issuer verifies real-world eligibility and registers your commitment out of
          band. For this simulator, that step runs automatically when you begin.
        </p>
        <Button onClick={handleRegister} variant="outline">
          Verify &amp; Register Credential
        </Button>
      </div>
    );
  }

  if (state.kind === "registering") {
    return <RitualProgress activeIndex={0} />;
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-lg border border-ignition-600/40 bg-ignition-600/10 p-4 text-sm text-ignition-200">
        {state.message}
      </div>
    );
  }

  if (state.kind === "pledging") {
    return <RitualProgress activeIndex={state.step} />;
  }

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-ink-200">
        Your credential is registered. Pledging proves membership and advances the quorum — without revealing
        which registered identity you are.
      </p>
      <Button onClick={handlePledge} variant="primary" size="lg" className="w-full sm:w-auto">
        Submit Private Pledge
      </Button>
    </div>
  );
}

function RitualProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <div>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {RITUAL_STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={step.label}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors duration-200",
                done && "border-signal-600/50 bg-signal-950/40",
                active && "border-signal-400 bg-signal-950/60",
                !done && !active && "border-ink-700 bg-ink-900/40"
              )}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={active ? "active" : done ? "done" : "pending"}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.18 }}
                >
                  <Icon className={cn("h-4 w-4", done || active ? "text-signal-300" : "text-ink-500")} />
                </motion.span>
              </AnimatePresence>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">{step.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs text-ink-500">
        Steps 2–5 all happen inside one circuit call, one proof, one transaction — animated for clarity, not
        sequenced on-chain.
      </p>
    </div>
  );
}
