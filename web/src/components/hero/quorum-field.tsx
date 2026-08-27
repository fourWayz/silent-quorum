"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

const QuorumFieldScene = dynamic(() => import("./quorum-field-scene").then((m) => m.QuorumFieldScene), {
  ssr: false,
  loading: () => null
});

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The hero centerpiece. Falls back to a static atmospheric field (no
 * canvas, no animation loop) when the viewer prefers reduced motion or
 * WebGL isn't available — the protocol metaphor still reads from the CSS
 * layer alone (see globals.css / the page's own background gradients). */
export function QuorumField() {
  const reducedMotion = useReducedMotion();
  const [capable, setCapable] = useState<boolean | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    // One-time client-only capability probe (WebGL support never changes
    // mid-session) — there is no render-safe alternative since this
    // depends on `document`, and no external store to subscribe to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCapable(webglAvailable());
    const mq = window.matchMedia("(max-width: 640px)");
    setNarrow(mq.matches);
    const listener = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  if (reducedMotion || capable === false) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background:
            "radial-gradient(circle at center, rgba(52,202,164,0.16), transparent 60%)"
        }}
      >
        <div className="h-64 w-64 rounded-full border border-signal-500/30 sm:h-96 sm:w-96" />
      </div>
    );
  }

  if (capable === null) return null;

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <QuorumFieldScene dense={!narrow} />
    </div>
  );
}
