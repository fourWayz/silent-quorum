// Silent Quorum — Preprod environment configuration.
//
// Endpoints verified live against the real network before use (see the
// Preprod deployment evidence report): indexer.preprod.midnight.network
// answered a live, advancing block-height query. Preview is NOT used —
// it was retired 2026-09-06 (confirmed empirically: its indexer returns a
// static, non-advancing height).
//
// The proof server still runs locally — it only does local ZK proof
// computation from the circuit's own proving keys and never needs to be
// "the same network" as the node/indexer it's paired with. Reuses the
// same local proof-server container already running for local-devnet
// testing (port 16300).

import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const preprodEnvConfig: EnvironmentConfiguration = {
  walletNetworkId: "preprod",
  networkId: "preprod",
  indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preprod.midnight.network",
  nodeWS: "wss://rpc.preprod.midnight.network",
  proofServer: "http://127.0.0.1:16300",
  faucet: "https://midnight-tmnight-preprod.nethermind.dev/"
};

/** Loads PREPROD_MNEMONIC from devnet-test/.env.preprod (gitignored — see
 * scripts/generate-preprod-wallet.mjs). Deliberately not printed or
 * logged anywhere; callers pass it straight into DevnetWalletProvider. */
export function loadPreprodMnemonic(): string {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.preprod");
  const raw = readFileSync(envPath, "utf8");
  const match = raw.match(/PREPROD_MNEMONIC="([^"]+)"/);
  if (!match) throw new Error(".env.preprod exists but PREPROD_MNEMONIC could not be parsed from it");
  return match[1];
}
