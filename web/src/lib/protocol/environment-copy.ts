import type { EnvironmentInfo } from "./types";

// Client-safe (no "server-only") — pure copy, imported by badge components.
// The actual connectivity probe lives in environment.ts.
export const ENVIRONMENT_COPY: Record<EnvironmentInfo["kind"], Omit<EnvironmentInfo, "kind">> = {
  simulator: {
    label: "Demo · Simulator",
    description:
      "Every pledge here runs the real compiled Compact circuits — the same independently audited contracts — executed server-side against an in-memory ledger. Not a live network."
  },
  demo: {
    label: "Demo Mode",
    description:
      "A scripted walkthrough that drives the same real simulator and the same state machine, auto-playing pledges instead of waiting for clicks."
  },
  "local-devnet": {
    label: "Local Devnet",
    description: "Connected to a live local Midnight devnet (node + indexer + proof server)."
  },
  preprod: {
    label: "Live · Midnight Preprod",
    description:
      "Real deployed contracts on Midnight Preprod, read directly from the live indexer. Read-only — no transactions are submitted from this page. See PREPROD_DEPLOYMENT.md for full deployment evidence."
  },
  unconfigured: {
    label: "Unconfigured",
    description: "No local devnet was reachable. Falling back to the in-process simulator."
  }
};
