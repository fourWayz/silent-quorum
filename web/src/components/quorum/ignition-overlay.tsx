"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/** The single most important animation in the frontend — the
 * threshold-crossing moment. Deliberately not an explosion: a controlled
 * pulse and a state label, gone within ~1.3s. Reduced-motion viewers get
 * an instant, non-animated banner instead. */
export function IgnitionOverlay({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDone, reducedMotion ? 1400 : 1300);
    return () => clearTimeout(t);
  }, [visible, onDone, reducedMotion]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="status"
          aria-live="assertive"
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          <motion.div
            className="absolute inset-0 bg-ink-950"
            initial={{ opacity: 0 }}
            animate={{ opacity: reducedMotion ? 0.7 : [0, 0.55, 0.7] }}
            transition={{ duration: 0.5 }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute h-[60vmin] w-[60vmin] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(242,165,61,0.55), transparent 70%)"
            }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={reducedMotion ? { scale: 1, opacity: 0.7 } : { scale: [0.3, 1.4, 1.1], opacity: [0, 1, 0.7] }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="relative flex flex-col items-center gap-3 text-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-ignition-200">
              Threshold Crossed
            </span>
            <span className="font-display text-5xl text-paper sm:text-6xl">Quorum Fired</span>
            <span className="max-w-sm text-sm text-ink-200">
              The consequence released in the same transaction that counted the crossing pledge.
            </span>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
