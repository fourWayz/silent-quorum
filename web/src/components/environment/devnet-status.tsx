"use client";

import { useEffect, useState } from "react";
import { devnetStatusAction } from "@/lib/protocol/actions";
import type { DevnetStatus } from "@/lib/protocol/environment";

/** A genuine, real connectivity probe against a local Midnight devnet's
 * indexer — not a decorative status light. Reports honestly when nothing
 * is reachable rather than defaulting to an optimistic state. */
export function DevnetStatusLine() {
  const [status, setStatus] = useState<DevnetStatus | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    devnetStatusAction().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return <span className="font-mono text-[11px] text-ink-400">Checking local devnet…</span>;
  }

  if (!status.reachable) {
    return (
      <span className="font-mono text-[11px] text-ink-400">
        Local devnet: <span className="text-mute-300">unreachable</span> — interactive flows use the Simulator.
      </span>
    );
  }

  return (
    <span className="font-mono text-[11px] text-ink-400">
      Local devnet reachable — indexer reports block height{" "}
      <span className="font-mono-tabular text-signal-300">{status.blockHeight}</span>. Interactive flows still use
      the Simulator in this build.
    </span>
  );
}
